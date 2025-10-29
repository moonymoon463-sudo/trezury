/**
 * Synthetix Trade Executor
 * Server-side trade execution for internal wallets
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'npm:ethers@6.15.0';
import * as crypto from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Perps Market ABI (minimal)
const PERPS_MARKET_ABI = [
  'function commitOrder(tuple(uint128 marketId, uint128 accountId, int128 sizeDelta, uint128 settlementStrategyId, uint256 acceptablePrice, bytes32 trackingCode, address referrer) commitment) payable',
  'function settleOrder(uint128 accountId, uint128 marketId)'
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
    const { request, chainId, password } = await req.json();

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

    // Decrypt wallet key
    const key = crypto.pbkdf2Sync(
      password,
      Buffer.from(walletData.salt, 'hex'),
      100000,
      32,
      'sha256'
    );
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(walletData.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(walletData.auth_tag, 'hex'));
    
    let privateKey = decipher.update(walletData.encrypted_key, 'hex', 'utf8');
    privateKey += decipher.final('utf8');

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
