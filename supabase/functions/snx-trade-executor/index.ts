/**
 * Synthetix Trade Executor
 * Server-side trade execution for internal wallets
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'npm:ethers@6.15.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Web Crypto API decryption to match frontend
async function decryptPrivateKey(
  encryptedKey: string,
  iv: string,
  salt: string,
  password: string
): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Base64 decode
  const encryptedBytes = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));

  // Derive key using PBKDF2
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const keyMaterial = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  );

  const aesKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    aesKey,
    encryptedBytes
  );

  return decoder.decode(decrypted);
}

// Perps Market ABI (minimal)
const PERPS_MARKET_ABI = [
  'function commitOrder(tuple(uint128 marketId, uint128 accountId, int128 sizeDelta, uint128 settlementStrategyId, uint256 acceptablePrice, bytes32 trackingCode, address referrer) commitment) payable',
  'function settleOrder(uint128 accountId, uint128 marketId)'
];

// Account Proxy ABI
const ACCOUNT_PROXY_ABI = [
  'function createAccount() external returns (uint128)',
  'event AccountCreated(uint128 indexed accountId, address indexed owner)'
];

// Account creation handler
async function handleAccountCreation(
  user: any,
  password: string,
  chainId: number,
  supabase: any
) {
  console.log('[CreateAccount] Starting for user:', user.id, 'chain:', chainId);

  // Get wallet data
  const { data: walletData, error: walletError } = await supabase
    .from('encrypted_wallet_keys')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (walletError || !walletData) {
    return new Response(
      JSON.stringify({ success: false, error: 'Internal wallet not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Decrypt private key
  let privateKey: string;
  try {
    privateKey = await decryptPrivateKey(
      walletData.encrypted_private_key,
      walletData.encryption_iv,
      walletData.encryption_salt,
      password
    );
  } catch (err) {
    console.error('[CreateAccount] Decryption failed:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Incorrect password' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Initialize provider and wallet
  const rpcUrl = chainId === 8453 ? 'https://mainnet.base.org' :
                 chainId === 1 ? 'https://eth.llamarpc.com' :
                 chainId === 42161 ? 'https://arb1.arbitrum.io/rpc' :
                 'https://mainnet.optimism.io';
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('[CreateAccount] Wallet address:', wallet.address);

  // Get account proxy address
  const addresses: Record<number, string> = {
    8453: '0x63f4Dd0434BEB5baeCD27F3778a909278d8cf5b8',
    42161: '0xcb68b813210aFa0373F076239Ad4803f8809e8cf',
    1: '0x0E429603D3Cb1DFae4E6F52Add5fE82d96d77Dac'
  };

  const accountProxyAddress = addresses[chainId];
  if (!accountProxyAddress) {
    return new Response(
      JSON.stringify({ success: false, error: 'Chain not supported' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const accountProxy = new ethers.Contract(accountProxyAddress, ACCOUNT_PROXY_ABI, wallet);

  // Check gas balance
  const balance = await provider.getBalance(wallet.address);
  const estimatedGas = await accountProxy.createAccount.estimateGas();
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? BigInt(0);
  const estimatedCost = estimatedGas * gasPrice;

  console.log('[CreateAccount] Balance:', ethers.formatEther(balance));
  console.log('[CreateAccount] Estimated cost:', ethers.formatEther(estimatedCost));

  if (balance < estimatedCost) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Insufficient gas funds',
        walletAddress: wallet.address,
        requiredGas: ethers.formatEther(estimatedCost),
        currentBalance: ethers.formatEther(balance)
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create account
  console.log('[CreateAccount] Calling createAccount()...');
  const tx = await accountProxy.createAccount();
  const receipt = await tx.wait();

  console.log('[CreateAccount] Transaction hash:', receipt.hash);

  // Parse account ID from logs
  let accountId: bigint | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === accountProxyAddress.toLowerCase()) {
      try {
        const parsed = accountProxy.interface.parseLog({
          topics: [...log.topics],
          data: log.data
        });
        if (parsed && parsed.name === 'AccountCreated') {
          accountId = parsed.args.accountId;
          console.log('[CreateAccount] Account ID from event:', accountId.toString());
          break;
        }
      } catch (e) {
        // Try parsing from topics directly
        if (log.topics.length > 1) {
          accountId = BigInt(log.topics[1]);
          console.log('[CreateAccount] Account ID from topics:', accountId.toString());
          break;
        }
      }
    }
  }

  if (!accountId) {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to parse account ID' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Store in database
  const { error: insertError } = await supabase
    .from('snx_accounts')
    .insert({
      user_id: user.id,
      account_id: accountId.toString(),
      chain_id: chainId,
      wallet_address: wallet.address
    });

  if (insertError) {
    console.error('[CreateAccount] Database insert failed:', insertError);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to store account' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[CreateAccount] Success! Account ID:', accountId.toString());

  return new Response(
    JSON.stringify({
      success: true,
      accountId: accountId.toString(),
      txHash: receipt.hash,
      walletAddress: wallet.address
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Rate limiting: Track last trade time per user
const userRateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 6000; // 6 seconds between trades

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { operation, request, chainId, password } = await req.json();

    // Handle account creation
    if (operation === 'create_account') {
      return await handleAccountCreation(user, password, chainId, supabase);
    }

    // Rate limiting check
    const lastTrade = userRateLimit.get(user.id) || 0;
    if (Date.now() - lastTrade < RATE_LIMIT_MS) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please wait a few seconds.' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check feature flag
    const featureEnabled = Deno.env.get('FEATURE_INTERNAL_SNX_TRADING') === 'true';
    if (!featureEnabled) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Internal trading is currently disabled' 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate risk limits
    const maxLeverage = parseInt(Deno.env.get('INTERNAL_TRADE_MAX_LEVERAGE') || '50');
    if (request.leverage > maxLeverage) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Leverage exceeds maximum of ${maxLeverage}×` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's internal wallet
    const { data: walletData, error: walletError } = await supabase
      .from('encrypted_wallet_keys')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (walletError || !walletData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Internal wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt wallet key using Web Crypto API
    let privateKey: string;
    try {
      privateKey = await decryptPrivateKey(
        walletData.encrypted_private_key,
        walletData.encryption_iv,
        walletData.encryption_salt,
        password
      );
    } catch (err) {
      console.error('[SnxTradeExecutor] Decryption failed:', err);
      return new Response(
        JSON.stringify({ success: false, error: 'Incorrect password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize provider & signer
    const rpcUrl = chainId === 8453 ? 'https://mainnet.base.org' :
                   chainId === 1 ? 'https://eth.llamarpc.com' :
                   chainId === 42161 ? 'https://arb1.arbitrum.io/rpc' :
                   'https://mainnet.optimism.io';
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('[SnxTradeExecutor] Executing trade for user:', user.id);
    console.log('[SnxTradeExecutor] Market:', request.marketKey);
    console.log('[SnxTradeExecutor] Side:', request.side, 'Size:', request.size);

    // Get account ID
    const { data: accountData } = await supabase
      .from('snx_accounts')
      .select('account_id')
      .eq('user_id', user.id)
      .eq('chain_id', chainId)
      .single();

    if (!accountData) {
      return new Response(
        JSON.stringify({ success: false, error: 'No trading account found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountId = BigInt(accountData.account_id);

    // Get contract addresses
    const addresses = {
      1: { perpsMarket: '0x0A2AF931eFFd34b81ebcc57E3d3c9B1E1dE1C9Ce' },
      8453: { perpsMarket: '0x0A2AF931eFFd34b81ebcc57E3d3c9B1E1dE1C9Ce' },
      42161: { perpsMarket: '0x0A2AF931eFFd34b81ebcc57E3d3c9B1E1dE1C9Ce' }
    };

    const perpsMarketAddress = addresses[chainId as keyof typeof addresses]?.perpsMarket;
    if (!perpsMarketAddress) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chain not supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const perpsMarket = new ethers.Contract(perpsMarketAddress, PERPS_MARKET_ABI, wallet);

    // Get market info (simplified - hardcoded for now)
    const markets = {
      'ETH': { marketId: 100 },
      'BTC': { marketId: 200 },
      'SOL': { marketId: 300 }
    };

    const marketInfo = markets[request.marketKey as keyof typeof markets];
    if (!marketInfo) {
      return new Response(
        JSON.stringify({ success: false, error: 'Market not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate size delta (positive for long, negative for short)
    const sizeDelta = request.side === 'BUY' ? request.size : -request.size;

    // Get current price (simplified - use oracle price)
    const currentPrice = 3500; // TODO: Fetch from Pyth oracle
    const slippageBps = request.slippageBps || 50;
    const acceptablePrice = request.side === 'BUY'
      ? currentPrice * (1 + slippageBps / 10000)
      : currentPrice * (1 - slippageBps / 10000);

    // Build commitment
    const commitment = {
      marketId: marketInfo.marketId,
      accountId: accountId,
      sizeDelta: ethers.parseEther(sizeDelta.toString()),
      settlementStrategyId: 0,
      acceptablePrice: ethers.parseEther(acceptablePrice.toString()),
      trackingCode: ethers.id('trezury-v1').slice(0, 66),
      referrer: ethers.ZeroAddress
    };

    // Execute trade
    console.log('[SnxTradeExecutor] Committing order...');
    const tx = await perpsMarket.commitOrder(commitment);
    const receipt = await tx.wait();

    console.log('[SnxTradeExecutor] Order committed:', receipt.hash);

    // Record order in database
    const { error: insertError } = await supabase
      .from('snx_orders')
      .insert({
        user_id: user.id,
        account_id: accountId.toString(),
        market_id: marketInfo.marketId.toString(),
        market_key: request.marketKey,
        type: request.type,
        side: request.side,
        size: request.size,
        leverage: request.leverage,
        price: request.price,
        status: 'FILLED',
        filled_size: request.size,
        filled_price: currentPrice,
        tx_hash: receipt.hash,
        chain_id: chainId,
        wallet_source: 'internal'
      });

    if (insertError) {
      console.error('[SnxTradeExecutor] Failed to record order:', insertError);
    }

    // Update rate limit
    userRateLimit.set(user.id, Date.now());

    return new Response(
      JSON.stringify({
        success: true,
        txHash: receipt.hash,
        order: {
          id: receipt.hash,
          status: 'FILLED',
          filledPrice: currentPrice
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[SnxTradeExecutor] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'EXECUTION_FAILED'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
