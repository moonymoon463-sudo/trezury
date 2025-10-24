import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { SocketClient, Network } from 'npm:@dydxprotocol/v4-client-js@3.0.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { dydxAddress, userId } = await req.json();

    if (!dydxAddress || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[dydx-order-monitor] Starting monitor for ${dydxAddress}`);

    const network = Deno.env.get('DYDX_NETWORK') === 'mainnet' 
      ? Network.mainnet() 
      : Network.testnet();

    const socket = new SocketClient(
      network.indexerConfig.websocketEndpoint,
      () => console.log('[dydx-order-monitor] WebSocket connected')
    );

    await socket.connect();

    // Subscribe to order updates
    socket.subscribeToOrders({
      id: dydxAddress,
      channel: 'v4_orders',
      callback: async (data: any) => {
        console.log('[dydx-order-monitor] Order update:', data);
        
        try {
          const order = data.contents?.orders?.[0];
          if (!order) return;

          await supabase
            .from('dydx_orders')
            .update({
              status: order.status,
              filled_size: parseFloat(order.totalFilled || '0'),
              average_fill_price: parseFloat(order.price || '0'),
              updated_at: new Date().toISOString(),
            })
            .eq('client_order_id', order.clientId)
            .eq('user_id', userId);
        } catch (error) {
          console.error('[dydx-order-monitor] Error updating order:', error);
        }
      },
    });

    // Subscribe to fills
    socket.subscribeToTrades({
      id: dydxAddress,
      channel: 'v4_trades',
      callback: async (data: any) => {
        console.log('[dydx-order-monitor] Fill update:', data);
        
        try {
          const fill = data.contents?.trades?.[0];
          if (!fill) return;

          // Update order with fill information
          await supabase
            .from('dydx_orders')
            .update({
              status: 'FILLED',
              filled_size: parseFloat(fill.size),
              average_fill_price: parseFloat(fill.price),
              filled_at: new Date().toISOString(),
            })
            .eq('client_order_id', fill.orderId)
            .eq('user_id', userId);

          // Update or create position
          const { data: existingPosition } = await supabase
            .from('dydx_positions')
            .select('*')
            .eq('user_id', userId)
            .eq('market', fill.market)
            .eq('status', 'OPEN')
            .single();

          if (existingPosition) {
            // Update existing position
            const newSize = fill.side === existingPosition.side
              ? existingPosition.size + parseFloat(fill.size)
              : existingPosition.size - parseFloat(fill.size);

            if (newSize <= 0) {
              // Position closed
              await supabase
                .from('dydx_positions')
                .update({
                  status: 'CLOSED',
                  closed_at: new Date().toISOString(),
                })
                .eq('id', existingPosition.id);
            } else {
              // Update position size
              await supabase
                .from('dydx_positions')
                .update({
                  size: newSize,
                  unrealized_pnl: 0, // Will be calculated
                })
                .eq('id', existingPosition.id);
            }
          } else {
            // Create new position
            await supabase.from('dydx_positions').insert({
              user_id: userId,
              address: dydxAddress,
              market: fill.market,
              side: fill.side === 'BUY' ? 'LONG' : 'SHORT',
              size: parseFloat(fill.size),
              entry_price: parseFloat(fill.price),
              leverage: 1, // Will be updated
              liquidation_price: 0, // Will be calculated
              status: 'OPEN',
            });
          }
        } catch (error) {
          console.error('[dydx-order-monitor] Error processing fill:', error);
        }
      },
    });

    // Subscribe to subaccount updates
    socket.subscribeToSubaccount({
      id: dydxAddress,
      subaccountNumber: 0,
      channel: 'v4_subaccounts',
      callback: async (data: any) => {
        console.log('[dydx-order-monitor] Subaccount update:', data);
        
        try {
          const subaccount = data.contents?.subaccount;
          if (!subaccount) return;

          await supabase.from('dydx_account_snapshots').insert({
            user_id: userId,
            address: dydxAddress,
            equity: parseFloat(subaccount.equity || '0'),
            free_collateral: parseFloat(subaccount.freeCollateral || '0'),
            margin_usage: parseFloat(subaccount.marginUsage || '0'),
          });
        } catch (error) {
          console.error('[dydx-order-monitor] Error saving snapshot:', error);
        }
      },
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      if (!socket.connected) {
        console.log('[dydx-order-monitor] Connection lost, reconnecting...');
        socket.connect();
      }
    }, 30000);

    // Cleanup on connection close
    socket.on('close', () => {
      console.log('[dydx-order-monitor] WebSocket closed');
      clearInterval(keepAlive);
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Order monitoring started' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[dydx-order-monitor] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
