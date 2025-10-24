import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        // Fetch account info from dYdX
        // NOTE: This is a placeholder - actual dYdX v4 integration requires
        // the dYdX client SDK and proper authentication
        const mockAccountInfo = {
          address: params.address,
          equity: 10000,
          freeCollateral: 8000,
          marginUsage: 0.2,
          totalPositionValue: 2000,
          openPositions: 0,
          pendingOrders: 0,
          unrealizedPnl: 0,
          realizedPnl: 0,
          lastUpdated: Date.now(),
        };

        return new Response(JSON.stringify(mockAccountInfo), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
        // Validate order parameters
        const { market, side, type, size, price, leverage } = params;

        if (!market || !side || !type || !size || !leverage) {
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

        // Generate client order ID
        const clientOrderId = `${user.id}-${Date.now()}`;

        // Calculate liquidation price
        const entryPrice = price || 0;
        const liquidationPrice =
          side === 'BUY'
            ? entryPrice * (1 - (1 / leverage - 0.03))
            : entryPrice * (1 + (1 / leverage - 0.03));

        // Insert order into database
        const { data: order, error: insertError } = await supabaseClient
          .from('dydx_orders')
          .insert({
            user_id: user.id,
            address: params.address || 'mock-address',
            client_order_id: clientOrderId,
            market,
            side,
            order_type: type,
            size,
            price,
            leverage,
            status: 'PENDING',
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

        console.log('[dYdX Trading] Order created:', order);

        // NOTE: In production, this would:
        // 1. Get user's private key from encrypted_wallet_keys
        // 2. Initialize dYdX client with user's wallet
        // 3. Sign and submit the order to dYdX v4 chain
        // 4. Update order status based on response

        // For now, simulate order fill for demo
        await supabaseClient
          .from('dydx_orders')
          .update({
            status: 'FILLED',
            filled_size: size,
            average_fill_price: price,
            filled_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        // Create position record
        if (side === 'BUY' || side === 'SELL') {
          await supabaseClient.from('dydx_positions').insert({
            user_id: user.id,
            address: params.address || 'mock-address',
            market,
            side: side === 'BUY' ? 'LONG' : 'SHORT',
            size,
            entry_price: price,
            leverage,
            liquidation_price: liquidationPrice,
            unrealized_pnl: 0,
            realized_pnl: 0,
            status: 'OPEN',
          });
        }

        return new Response(
          JSON.stringify({
            order: {
              ...order,
              status: 'FILLED',
              filled_size: size,
              average_fill_price: price,
            },
            txHash: `mock-tx-${Date.now()}`,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'cancel_order': {
        const { orderId } = params;

        const { error: updateError } = await supabaseClient
          .from('dydx_orders')
          .update({ status: 'CANCELLED' })
          .eq('id', orderId)
          .eq('user_id', user.id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to cancel order' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'close_position': {
        const { market, size } = params;

        // Get open position
        const { data: position, error: posError } = await supabaseClient
          .from('dydx_positions')
          .select('*')
          .eq('user_id', user.id)
          .eq('market', market)
          .eq('status', 'OPEN')
          .single();

        if (posError || !position) {
          return new Response(
            JSON.stringify({ error: 'Position not found' }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Close the position
        const closeSize = size || position.size;
        const closeSide = position.side === 'LONG' ? 'SELL' : 'BUY';

        // Create closing order
        const clientOrderId = `close-${user.id}-${Date.now()}`;

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
            leverage: 1,
            status: 'FILLED',
            filled_size: closeSize,
            reduce_only: true,
          })
          .select()
          .single();

        if (orderError) {
          return new Response(
            JSON.stringify({ error: 'Failed to create close order' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Update position status
        await supabaseClient
          .from('dydx_positions')
          .update({
            status: 'CLOSED',
            closed_at: new Date().toISOString(),
          })
          .eq('id', position.id);

        return new Response(
          JSON.stringify({
            order: closeOrder,
            txHash: `mock-close-tx-${Date.now()}`,
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
