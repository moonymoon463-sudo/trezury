import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz';

serve(async (req) => {
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

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { operation, params } = await req.json();

    switch (operation) {
      case 'get_account': {
        const { address } = params;
        
        const response = await fetch(`${HYPERLIQUID_API}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'clearinghouseState',
            user: address
          })
        });

        const accountState = await response.json();
        
        return new Response(JSON.stringify(accountState), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_positions': {
        const { address } = params;
        
        // Fetch from Hyperliquid API
        const response = await fetch(`${HYPERLIQUID_API}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'clearinghouseState',
            user: address
          })
        });

        const accountState = await response.json();
        const positions = accountState.assetPositions || [];
        
        // Sync to database
        for (const pos of positions) {
          if (parseFloat(pos.position.szi) !== 0) {
            const { error: upsertError } = await supabaseClient
              .from('hyperliquid_positions')
              .upsert({
                user_id: user.id,
                address,
                market: pos.position.coin,
                side: parseFloat(pos.position.szi) > 0 ? 'LONG' : 'SHORT',
                size: Math.abs(parseFloat(pos.position.szi)),
                entry_price: parseFloat(pos.position.entryPx || '0'),
                leverage: parseFloat(pos.position.leverage?.value || '1'),
                unrealized_pnl: parseFloat(pos.position.unrealizedPnl || '0'),
                liquidation_price: parseFloat(pos.position.liquidationPx || '0'),
                status: 'OPEN',
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'user_id,address,market',
                ignoreDuplicates: false
              });

            if (upsertError) {
              console.error('Position upsert error:', upsertError);
            }
          }
        }
        
        return new Response(JSON.stringify(positions), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_orders': {
        const { address } = params;
        
        // Fetch from Hyperliquid API
        const response = await fetch(`${HYPERLIQUID_API}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'openOrders',
            user: address
          })
        });

        const orders = await response.json();
        
        return new Response(JSON.stringify(orders), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'place_order': {
        const { address, market, side, type: orderType, size, price, leverage, action, signature, nonce, reduceOnly, postOnly, timeInForce, clientOrderId } = params;

        // Submit to Hyperliquid API with signature
        const hyperliquidResponse = await fetch('https://api.hyperliquid-testnet.xyz/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            nonce,
            signature
          })
        });

        const result = await hyperliquidResponse.json();

        if (result.status === 'ok') {
          // Store successful order in database for tracking
          const orderId = result.response?.data?.statuses?.[0]?.resting?.oid;
          
          const { data: orderData, error: insertError } = await supabaseClient
            .from('hyperliquid_orders')
            .insert({
              user_id: user.id,
              address,
              order_id: orderId,
              client_order_id: clientOrderId || `${nonce}`,
              market,
              side,
              order_type: orderType,
              size,
              price,
              leverage,
              reduce_only: reduceOnly || false,
              post_only: postOnly || false,
              time_in_force: timeInForce || 'GTC',
              status: 'OPEN',
              external_id: orderId
            })
            .select()
            .single();

          if (insertError) {
            console.error('Order insert error:', insertError);
          }

          console.log('[place_order] Success:', { orderId, market, side, size });

          return new Response(
            JSON.stringify({
              status: 'ok',
              success: true,
              order: {
                id: orderData?.id,
                orderId: orderId,
                clientOrderId: clientOrderId || `${nonce}`,
                market,
                side,
                type: orderType,
                size,
                price,
                status: 'OPEN'
              },
              response: result.response
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } else {
          console.error('[place_order] Failed:', result);
          
          return new Response(
            JSON.stringify({
              status: 'error',
              success: false,
              error: result.response?.data?.statuses?.[0]?.error || 'Failed to place order',
              response: result.response
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }

      case 'cancel_order': {
        const { address, orderId, market } = params;

        // Update order status in database
        const { error: updateError } = await supabaseClient
          .from('hyperliquid_orders')
          .update({ status: 'CANCELLED' })
          .eq('user_id', user.id)
          .eq('address', address)
          .eq('order_id', orderId);

        if (updateError) {
          throw updateError;
        }

        return new Response(
          JSON.stringify({ success: true }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'cancel_all_orders': {
        const { address, market } = params;

        const query = supabaseClient
          .from('hyperliquid_orders')
          .update({ status: 'CANCELLED' })
          .eq('user_id', user.id)
          .eq('address', address)
          .in('status', ['PENDING', 'OPEN', 'PARTIALLY_FILLED']);

        if (market) {
          query.eq('market', market);
        }

        const { error: updateError } = await query;

        if (updateError) {
          throw updateError;
        }

        return new Response(
          JSON.stringify({ success: true }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'close_position': {
        const { address, market, size } = params;

        // Place market order in opposite direction to close position
        const nonce = Date.now();

        // Get existing position to determine side
        const { data: position } = await supabaseClient
          .from('hyperliquid_positions')
          .select('*')
          .eq('user_id', user.id)
          .eq('address', address)
          .eq('market', market)
          .eq('status', 'OPEN')
          .single();

        if (!position) {
          throw new Error('No open position found');
        }

        const closeSide = position.side === 'LONG' ? 'SELL' : 'BUY';

        // Insert close order
        const { data: orderData, error: insertError } = await supabaseClient
          .from('hyperliquid_orders')
          .insert({
            user_id: user.id,
            address,
            client_order_id: `close_${nonce}`,
            market,
            side: closeSide,
            order_type: 'MARKET',
            size: size || position.size,
            leverage: position.leverage,
            reduce_only: true,
            status: 'PENDING'
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        return new Response(
          JSON.stringify({
            success: true,
            order: {
              id: orderData.id,
              market,
              side: closeSide,
              type: 'MARKET',
              size: size || position.size,
              status: 'PENDING'
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'update_leverage': {
        const { address, market, leverage, isCross } = params;

        // Hyperliquid leverage update would happen here
        // For now, just acknowledge
        
        return new Response(
          JSON.stringify({ success: true }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    console.error('Hyperliquid trading error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
