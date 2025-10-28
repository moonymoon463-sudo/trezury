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

// Perps Market ABI (minimal)
const PERPS_MARKET_ABI = [
  'function commitOrder(tuple(uint128 marketId, uint128 accountId, int128 sizeDelta, uint128 settlementStrategyId, uint256 acceptablePrice, bytes32 trackingCode, address referrer) commitment) payable',
  'function settleOrder(uint128 accountId, uint128 marketId)'
];

// Account Proxy ABI with events
const ACCOUNT_PROXY_ABI = [
  'function createAccount() external returns (uint128 accountId)',
  'function getAccountOwner(uint128 accountId) external view returns (address)',
  'event AccountCreated(uint128 indexed accountId, address indexed owner)'
];

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

    // Handle account creation operation
    if (operation === 'create_account') {
      return await handleCreateAccountInline(user, chainId, password, supabase);
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

    // Decrypt wallet key - match frontend Web Crypto format
    let privateKey: string;
    
    try {
      privateKey = await decryptPrivateKeyWebCrypto(walletData, password);
    } catch (error) {
      console.error('[Decryption] Failed:', error);
      throw new Error('Incorrect password or wallet data mismatch');
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

    // Get contract addresses (Synthetix V3)
    const addresses: Record<number, { perpsMarket: string; accountProxy: string }> = {
      1: { 
        perpsMarket: '0x0A2AF931eFFd34b81ebcc57E3d3c9B1E1dE1C9Ce',
        accountProxy: '0x0E429603D3Cb1DFae4E6F52Add5fE82d96d77Dac'
      },
      8453: { 
        perpsMarket: '0x0A2AF931eFFd34b81ebcc57E3d3c9B1E1dE1C9Ce',
        accountProxy: '0x63f4Dd0434BEB5baeCD27F3778a909278d8cf5b8'
      },
      42161: { 
        perpsMarket: '0x0A2AF931eFFd34b81ebcc57E3d3c9B1E1dE1C9Ce',
        accountProxy: '0xcb68b813210aFa0373F076239Ad4803f8809e8cf'
      }
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

/**
 * Decrypt private key using Web Crypto API (matches frontend encryption)
 */
async function decryptPrivateKeyWebCrypto(
  walletData: any,
  password: string
): Promise<string> {
  // Frontend uses base64-encoded fields: encrypted_private_key, encryption_iv, encryption_salt
  const encryptedPrivateKey = walletData.encrypted_private_key;
  const encryptionIv = walletData.encryption_iv;
  const encryptionSalt = walletData.encryption_salt;
  
  if (!encryptedPrivateKey || !encryptionIv || !encryptionSalt) {
    throw new Error('Missing encryption fields in wallet data');
  }
  
  // Decode base64 to Uint8Array
  const salt = Uint8Array.from(atob(encryptionSalt), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(encryptionIv), c => c.charCodeAt(0));
  const encryptedData = Uint8Array.from(atob(encryptedPrivateKey), c => c.charCodeAt(0));
  
  // Determine decryption password (legacy uses userId)
  const decryptionPassword = walletData.encryption_method === 'legacy_userid' 
    ? walletData.user_id 
    : password;
  
  // Derive key using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(decryptionPassword),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  // Decrypt (auth tag is included in encryptedData for GCM mode)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encryptedData
  );
  
  return new TextDecoder().decode(decrypted);
}

/**
 * Handle Synthetix Account Creation (merged inline for compliance)
 */
async function handleCreateAccountInline(
  user: any,
  chainId: number,
  password: string,
  supabase: any
): Promise<Response> {
  try {
    console.log('[CreateAccount] Starting for user:', user.id, 'chain:', chainId);

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from('snx_accounts')
      .select('account_id')
      .eq('user_id', user.id)
      .eq('chain_id', chainId)
      .maybeSingle();

    if (existingAccount) {
      return new Response(
        JSON.stringify({
          success: true,
          accountId: existingAccount.account_id,
          message: 'Account already exists'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's wallet
    const { data: walletData, error: walletError } = await supabase
      .from('encrypted_wallet_keys')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (walletError || !walletData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Internal wallet not found. Please create a wallet first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt wallet key using Web Crypto
    let privateKey: string;
    
    try {
      privateKey = await decryptPrivateKeyWebCrypto(walletData, password);
    } catch (error) {
      console.error('[CreateAccount] Decryption failed:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Incorrect password or wallet data mismatch. If you imported an older wallet, please contact support.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize provider
    const rpcUrl = chainId === 8453 ? 'https://mainnet.base.org' :
                   chainId === 1 ? 'https://eth.llamarpc.com' :
                   chainId === 42161 ? 'https://arb1.arbitrum.io/rpc' :
                   'https://mainnet.optimism.io';
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('[CreateAccount] Wallet address:', wallet.address, 'Chain:', chainId, 'RPC:', rpcUrl);

    // Get AccountProxy address (validated against src/config/snxAddresses.ts)
    const accountProxyAddresses: Record<number, string> = {
      1: '0x0E429603D3Cb1DFae4E6F52Add5fE82d96d77Dac',      // Ethereum
      8453: '0x63f4Dd0434BEB5baeCD27F3778a909278d8cf5b8',   // Base
      42161: '0xcb68b813210aFa0373F076239Ad4803f8809e8cf'   // Arbitrum
    };

    const accountProxyAddress = accountProxyAddresses[chainId];
    if (!accountProxyAddress) {
      return new Response(
        JSON.stringify({ success: false, error: `Chain ${chainId} not supported for Synthetix trading` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountProxy = new ethers.Contract(accountProxyAddress, ACCOUNT_PROXY_ABI, wallet);

    // Check gas balance
    console.log('[CreateAccount] Checking gas balance...');
    const balance = await provider.getBalance(wallet.address);
    
    // Correct gas estimation API
    let estimatedGas: bigint;
    try {
      estimatedGas = await accountProxy.estimateGas.createAccount();
    } catch (error) {
      console.error('[CreateAccount] Gas estimation failed:', error);
      estimatedGas = BigInt(150000); // Fallback
    }
    
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? BigInt(0);
    const estimatedCost = estimatedGas * gasPrice;

    console.log('[CreateAccount] Balance:', ethers.formatEther(balance), 
                'Estimated gas:', estimatedGas.toString(),
                'Gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei',
                'Estimated cost:', ethers.formatEther(estimatedCost));

    if (balance < estimatedCost) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Insufficient gas funds`,
          walletAddress: wallet.address,
          requiredGas: ethers.formatEther(estimatedCost),
          currentBalance: ethers.formatEther(balance),
          chainId: chainId
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create account on-chain
    console.log('[CreateAccount] Calling createAccount() on contract:', accountProxyAddress);
    const tx = await accountProxy.createAccount();
    console.log('[CreateAccount] Transaction sent:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('[CreateAccount] Transaction confirmed:', receipt.hash);

    // Parse account ID from events
    let accountId: bigint | undefined;

    for (const log of receipt.logs) {
      try {
        const parsedLog = accountProxy.interface.parseLog({
          topics: [...log.topics],
          data: log.data
        });
        
        if (parsedLog && parsedLog.name === 'AccountCreated') {
          accountId = parsedLog.args.accountId;
          console.log('[CreateAccount] Parsed account ID:', accountId.toString());
          break;
        }
      } catch (e) {
        // Not our event
      }
    }

    if (!accountId) {
      console.error('[CreateAccount] Failed to parse account ID from logs');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to parse account ID from transaction receipt. This may be a contract issue.',
          txHash: receipt.hash 
        }),
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
        wallet_address: wallet.address,
        created_tx_hash: receipt.hash
      });

    if (insertError) {
      console.error('[CreateAccount] DB insert failed:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to store account in database' }),
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

  } catch (error) {
    console.error('[CreateAccount] Error:', error);
    
    let errorMessage = 'Failed to create account';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        errorCode: 'ACCOUNT_CREATION_FAILED'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
