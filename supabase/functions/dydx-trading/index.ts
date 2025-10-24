import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to decrypt mnemonic (matches frontend encryption)
async function decryptMnemonic(
  encryptedData: string,
  iv: string,
  salt: string,
  password: string
): Promise<string> {
  // Note: In production, this would use Web Crypto API or a secure library
  // For now, we'll require the frontend to pass the decrypted mnemonic
  // Or implement server-side decryption with proper key management
  throw new Error('Server-side decryption not yet implemented - use client-side signing');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { operation, params } = await req.json();

    console.log(`[dYdX Trading] Operation: ${operation}`, params);

    switch (operation) {
      case 'get_account': {
        // Fetch real account info from dYdX indexer
        const { address } = params;
        
        if (!address || !address.startsWith('dydx1')) {
          return new Response(
            JSON.stringify({ error: 'Invalid dYdX address' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        try {
          // Query dYdX mainnet indexer for subaccount data
          const indexerUrl = `https://indexer.dydx.trade/v4/addresses/${address}/subaccountNumber/0`;
          
          const response = await fetch(indexerUrl);
          
          if (!response.ok) {
            if (response.status === 404) {
              // Account doesn't exist yet - return zero balance
              return new Response(
                JSON.stringify({
                  address,
                  equity: 0,
                  freeCollateral: 0,
                  marginUsage: 0,
                  totalPositionValue: 0,
                  openPositions: 0,
                  pendingOrders: 0,
                  unrealizedPnl: 0,
                  realizedPnl: 0,
                  lastUpdated: Date.now(),
                }),
                {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              );
            }
            throw new Error(`Indexer error: ${response.statusText}`);
          }

          const data = await response.json();
          const subaccount = data.subaccount || {};

          // Transform indexer response to our format
          const accountInfo = {
            address,
            equity: parseFloat(subaccount.equity || '0'),
            freeCollateral: parseFloat(subaccount.freeCollateral || '0'),
            marginUsage: parseFloat(subaccount.marginUsed || '0') / parseFloat(subaccount.equity || '1'),
            totalPositionValue: parseFloat(subaccount.notionalTotal || '0'),
            openPositions: subaccount.openPerpetualPositions?.length || 0,
            pendingOrders: 0, // Would need to query orders endpoint
            unrealizedPnl: parseFloat(subaccount.unrealizedPnl || '0'),
            realizedPnl: 0,
            lastUpdated: Date.now(),
          };

          return new Response(JSON.stringify(accountInfo), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('[dYdX Trading] Error fetching account:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch account data' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }

      case 'get_leverage_config': {
        const { market } = params;
        const majorMarkets = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
        const maxLeverage = majorMarkets.includes(market) ? 20 : 10;

        const leverageConfig = {
          market,
          currentLeverage: 1,
          maxLeverage,
          initialMarginFraction: 1 / maxLeverage,
          maintenanceMarginFraction: 0.03,
        };

        return new Response(JSON.stringify(leverageConfig), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'place_order': {
        /**
         * CRITICAL: This is where real dYdX v4 SDK integration goes
         * 
         * Required steps:
         * 1. Import @dydxprotocol/v4-client-js (CompositeClient, LocalWallet, etc.)
         * 2. Get user's encrypted dYdX wallet mnemonic from dydx_wallets table
         * 3. Decrypt mnemonic (securely)
         * 4. Create LocalWallet from mnemonic
         * 5. Initialize CompositeClient
         * 6. Call client.placeOrder() with proper parameters
         * 7. Store tx hash and order ID
         * 8. Set status to 'OPEN' (not FILLED - fills come from WebSocket)
         * 
         * For now, this is a placeholder that stores the order but doesn't execute it.
         */

        const { market, side, type, size, price, leverage, address } = params;

        // Validate required parameters
        if (!market || !side || !type || !size || !leverage || !address) {
          return new Response(
            JSON.stringify({ error: 'Missing required parameters' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Validate leverage limits
        const majorMarkets = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
        const maxLeverage = majorMarkets.includes(market) ? 20 : 10;

        if (leverage > maxLeverage) {
          return new Response(
            JSON.stringify({
              error: `Maximum leverage for ${market} is ${maxLeverage}x`,
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Generate unique client order ID
        const clientOrderId = `${user.id.slice(0, 8)}-${Date.now()}`;

        // Calculate liquidation price
        const entryPrice = price || 0;
        const maintenanceMargin = 0.03; // 3% maintenance margin
        const liquidationPrice =
          side === 'BUY'
            ? entryPrice * (1 - (1 / leverage - maintenanceMargin))
            : entryPrice * (1 + (1 / leverage - maintenanceMargin));

        // Insert order into database
        const { data: order, error: insertError } = await supabaseClient
          .from('dydx_orders')
          .insert({
            user_id: user.id,
            address: address,
            client_order_id: clientOrderId,
            market,
            side,
            order_type: type,
            size,
            price: type === 'MARKET' ? null : price,
            leverage,
            status: 'PENDING',
            time_in_force: type === 'MARKET' ? 'IOC' : 'GTT',
            post_only: type === 'LIMIT' ? params.postOnly || false : false,
            reduce_only: params.reduceOnly || false,
          })
          .select()
          .single();

        if (insertError) {
          console.error('[dYdX Trading] Order insert error:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to create order' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        console.log('[dYdX Trading] Order created in DB:', order);

        /**
         * TODO: Real dYdX v4 order placement
         * 
         * Uncomment and implement when ready:
         * 
         * // Get user's dYdX wallet
         * const { data: wallet } = await supabaseClient
         *   .from('dydx_wallets')
         *   .select('encrypted_mnemonic, encryption_iv, encryption_salt')
         *   .eq('user_id', user.id)
         *   .single();
         * 
         * // Initialize dYdX client
         * const client = await CompositeClient.connect(Network.mainnet());
         * 
         * // Create wallet for signing
         * const localWallet = await LocalWallet.fromMnemonic(decryptedMnemonic, 'dydx');
         * const subaccount = new SubaccountClient(localWallet, 0);
         * 
         * // Place order
         * const orderParams = {
         *   market,
         *   side: side === 'BUY' ? OrderSide.BUY : OrderSide.SELL,
         *   type: type === 'MARKET' ? OrderType.MARKET : OrderType.LIMIT,
         *   price: type === 'LIMIT' ? price : null,
         *   size,
         *   timeInForce: type === 'MARKET' ? OrderTimeInForce.IOC : OrderTimeInForce.GTT,
         *   goodTilTimeInSeconds: type === 'LIMIT' ? 3600 : 0, // 1 hour for limit orders
         *   clientId: parseInt(clientOrderId.split('-')[1]),
         *   postOnly: params.postOnly || false,
         *   reduceOnly: params.reduceOnly || false
         * };
         * 
         * const tx = await client.placeOrder(subaccount, ...orderParams);
         * 
         * // Update order with tx hash and dYdX order ID
         * await supabaseClient
         *   .from('dydx_orders')
         *   .update({
         *     tx_hash: tx.hash,
         *     order_id: tx.orderId,
         *     status: 'OPEN'
         *   })
         *   .eq('id', order.id);
         */

        // For now, return the database order as pending
        // The order will be updated by WebSocket monitoring when it fills
        return new Response(
          JSON.stringify({
            success: true,
            order: {
              ...order,
              status: 'PENDING',
            },
            message: 'Order created - awaiting execution',
            // TODO: Add real txHash from dYdX
            txHash: null,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'cancel_order': {
        const { orderId } = params;

        if (!orderId) {
          return new Response(
            JSON.stringify({ error: 'Order ID required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Update order status to cancelled
        const { error: updateError } = await supabaseClient
          .from('dydx_orders')
          .update({
            status: 'CANCELLED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('[dYdX Trading] Cancel error:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to cancel order' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        /**
         * TODO: Real order cancellation on dYdX Chain
         * 
         * const client = await CompositeClient.connect(Network.mainnet());
         * await client.cancelOrder(subaccount, orderId, goodTilBlock);
         */

        return new Response(
          JSON.stringify({ success: true, message: 'Order cancelled' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'close_position': {
        const { market, size } = params;

        if (!market) {
          return new Response(
            JSON.stringify({ error: 'Market required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Get open position
        const { data: position, error: posError } = await supabaseClient
          .from('dydx_positions')
          .select('*')
          .eq('user_id', user.id)
          .eq('market', market)
          .eq('status', 'OPEN')
          .maybeSingle();

        if (posError || !position) {
          return new Response(
            JSON.stringify({ error: 'Position not found' }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const closeSize = size || Math.abs(position.size);
        const closeSide = position.side === 'LONG' ? 'SELL' : 'BUY';

        // Create market order to close position
        const clientOrderId = `close-${user.id.slice(0, 8)}-${Date.now()}`;

        const { data: closeOrder, error: orderError } = await supabaseClient
          .from('dydx_orders')
          .insert({
            user_id: user.id,
            address: position.address,
            client_order_id: clientOrderId,
            market,
            side: closeSide,
            order_type: 'MARKET',
            size: closeSize,
            leverage: position.leverage,
            status: 'PENDING',
            reduce_only: true,
          })
          .select()
          .single();

        if (orderError) {
          console.error('[dYdX Trading] Close order error:', orderError);
          return new Response(
            JSON.stringify({ error: 'Failed to create close order' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        /**
         * TODO: Real position closing on dYdX Chain
         * 
         * const client = await CompositeClient.connect(Network.mainnet());
         * await client.placeOrder(subaccount, {
         *   market,
         *   side: closeSide,
         *   type: OrderType.MARKET,
         *   size: closeSize,
         *   reduceOnly: true,
         *   ...
         * });
         */

        // Update position status to closed
        await supabaseClient
          .from('dydx_positions')
          .update({
            status: 'CLOSED',
            closed_at: new Date().toISOString(),
          })
          .eq('id', position.id);

        return new Response(
          JSON.stringify({
            success: true,
            order: closeOrder,
            message: 'Position close order created',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown operation' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }
  } catch (error) {
    console.error('[dYdX Trading] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
