import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

async function decryptMnemonic(encryptedData: string, iv: string, salt: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const passwordKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: hexToBytes(salt), iterations: 100000, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBytes(iv) }, key, hexToBytes(encryptedData));
  return decoder.decode(decrypted);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

Deno.serve(async (req) => {
  console.log('[dydx-trading] Request received:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[dydx-trading] Authentication failed:', authError);
      return new Response(JSON.stringify({ 
        ok: false,
        message: 'Authentication required',
        data: { errorCode: 'UNAUTHORIZED' }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[dydx-trading] Authenticated user:', user.id);

    const body = await req.json().catch(() => ({}));
    const { operation, params } = body;
    console.log('[dydx-trading] Operation:', operation, 'Params:', JSON.stringify(params));
    
    const indexerUrl = Deno.env.get('DYDX_NETWORK') === 'mainnet'
      ? 'https://indexer.dydx.trade/v4'
      : 'https://indexer.v4testnet.dydx.exchange/v4';

    // Ping operation
    if (operation === 'ping') {
      console.log('[dydx-trading] Ping received');
      return new Response(JSON.stringify({ 
        ok: true,
        message: 'Service healthy',
        data: { 
          timestamp: Date.now(),
          service: 'dydx-trading',
          version: '3.0.0'
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get account operation
    if (operation === 'get_account') {
      try {
        console.log(`[dydx-trading] Fetching account for ${params.address}`);
        const response = await fetch(`${indexerUrl}/addresses/${params.address}/subaccountNumber/0`);
        
        if (!response.ok) {
          // Handle 404 specifically - account doesn't exist yet (unfunded)
          if (response.status === 404) {
            console.log(`[dydx-trading] Account not found (unfunded): ${params.address}`);
            // Return zero balances for unfunded accounts
            const emptyAccountInfo = {
              address: params.address,
              equity: 0,
              freeCollateral: 0,
              marginUsage: 0,
              openPositions: 0,
              unrealizedPnl: 0,
            };
            
            return new Response(JSON.stringify({
              ok: true,
              message: 'Account not found - needs funding',
              data: { 
                account: emptyAccountInfo,
                needsFunding: true
              }
            }), { 
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          }
          
          console.error(`[dydx-trading] Indexer error: ${response.status}`);
          return new Response(JSON.stringify({
            ok: false,
            message: `dYdX Indexer API returned ${response.status}`,
            data: { errorCode: 'INDEXER_ERROR' }
          }), { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        
        const data = await response.json();
        const sub = data.subaccount || {};
        
        const accountInfo = {
          address: params.address,
          equity: parseFloat(sub.equity || '0'),
          freeCollateral: parseFloat(sub.freeCollateral || '0'),
          marginUsage: parseFloat(sub.marginUsage || '0'),
          openPositions: sub.openPerpetualPositions?.length || 0,
          unrealizedPnl: parseFloat(sub.unrealizedPnl || '0'),
        };
        
        console.log(`[dydx-trading] Account fetched successfully:`, accountInfo);
        
        return new Response(JSON.stringify({
          ok: true,
          message: 'Account fetched successfully',
          data: { account: accountInfo }
        }), { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      } catch (err) {
        console.error('[dydx-trading] get_account error:', err);
        return new Response(JSON.stringify({
          ok: false,
          message: err.message || 'Failed to fetch account',
          data: { errorCode: 'ACCOUNT_FETCH_ERROR' }
        }), { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // Get leverage config operation
    if (operation === 'get_leverage_config') {
      console.log('[dydx-trading] Getting leverage config for:', params.market);
      const limits: Record<string, number> = { 'BTC-USD': 20, 'ETH-USD': 20, 'SOL-USD': 10, 'DOGE-USD': 10 };
      const max = limits[params.market] || 10;
      
      return new Response(JSON.stringify({
        ok: true,
        message: 'Leverage config retrieved',
        data: { 
          config: { 
            market: params.market, 
            maxLeverage: max, 
            initialMarginFraction: 1/max, 
            maintenanceMarginFraction: 1/(max*2) 
          }
        }
      }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Place order operation
    if (operation === 'place_order') {
      try {
        console.log('[dydx-trading] Place order request:', { 
          market: params.market, 
          side: params.side, 
          type: params.type, 
          size: params.size 
        });
        
        console.log('[dydx-trading] Loading dYdX SDK for order placement...');
        const dydx = await import('https://esm.sh/@dydxprotocol/v4-client-js@3.0.7');
        const { CompositeClient, Network, LocalWallet, OrderTimeInForce, OrderExecution, OrderSide, OrderType } = dydx;

        console.log('[dydx-trading] Fetching dYdX wallet...');
        const { data: wallet, error: walletError } = await supabase
          .from('dydx_wallets')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (walletError || !wallet) {
          console.error('[dydx-trading] Wallet not found:', walletError);
          return new Response(JSON.stringify({
            ok: false,
            message: 'dYdX wallet not found. Please set up your trading wallet first.',
            data: { errorCode: 'NO_WALLET' }
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('[dydx-trading] Decrypting wallet mnemonic...');
        const mnemonic = await decryptMnemonic(
          wallet.encrypted_mnemonic, 
          wallet.encryption_iv, 
          wallet.encryption_salt, 
          params.password
        );
        
        console.log('[dydx-trading] Creating local wallet from mnemonic...');
        const localWallet = await LocalWallet.fromMnemonic(mnemonic, 'dydx');
        
        const network = Deno.env.get('DYDX_NETWORK') === 'mainnet' ? Network.mainnet() : Network.testnet();
        console.log('[dydx-trading] Connecting to dYdX network:', Deno.env.get('DYDX_NETWORK') || 'testnet');
        const client = await CompositeClient.connect(network);
        
        const clientId = Math.floor(Math.random() * 1000000000);
        console.log('[dydx-trading] Placing order with clientId:', clientId);

        const tx = await client.placeOrder(
          localWallet, 0, clientId, params.market,
          params.type === 'MARKET' ? OrderType.MARKET : OrderType.LIMIT,
          params.side === 'BUY' ? OrderSide.BUY : OrderSide.SELL,
          params.price || 0, params.size, clientId,
          params.type === 'MARKET' ? OrderTimeInForce.IOC : OrderTimeInForce.GTT,
          params.type === 'LIMIT' ? Math.floor(Date.now()/1000) + 3600 : 0,
          OrderExecution.DEFAULT, params.postOnly || false, params.reduceOnly || false
        );

        console.log('[dydx-trading] Order placed successfully, tx hash:', tx.hash);

        const { data: order, error: orderError } = await supabase
          .from('dydx_orders')
          .insert({
            user_id: user.id, 
            address: wallet.dydx_address, 
            client_order_id: clientId.toString(),
            market: params.market, 
            side: params.side, 
            order_type: params.type, 
            size: params.size,
            price: params.price || null, 
            leverage: params.leverage, 
            status: 'OPEN',
            tx_hash: tx.hash, 
            metadata: { tx }
          })
          .select()
          .single();

        if (orderError) {
          console.error('[dydx-trading] Failed to record order:', orderError);
        }

        return new Response(JSON.stringify({ 
          ok: true,
          message: 'Order placed successfully',
          data: { 
            order, 
            txHash: tx.hash
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('[dydx-trading] Order placement error:', error);
        
        let errorMessage = error.message || 'Failed to place order';
        let errorCode = 'DYDX_SDK_ERROR';
        
        if (errorMessage.includes('wallet not found')) {
          errorCode = 'NO_WALLET';
        } else if (errorMessage.includes('decrypt') || errorMessage.includes('password')) {
          errorCode = 'WRONG_PASSWORD';
          errorMessage = 'Invalid trading password. Please try again.';
        } else if (errorMessage.includes('insufficient')) {
          errorCode = 'INSUFFICIENT_BALANCE';
          errorMessage = 'Insufficient balance for this trade.';
        }
        
        return new Response(JSON.stringify({ 
          ok: false,
          message: errorMessage,
          data: { errorCode }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.error('[dydx-trading] Unknown operation:', operation);
    return new Response(JSON.stringify({ 
      ok: false,
      message: `Operation '${operation}' is not supported`,
      data: { errorCode: 'UNKNOWN_OPERATION' }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[dydx-trading] Unhandled error:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      message: error?.message || 'Internal server error',
      data: { errorCode: 'INTERNAL_ERROR' }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
