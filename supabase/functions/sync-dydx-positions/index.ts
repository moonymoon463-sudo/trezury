import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[sync-dydx-positions] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { dydxAddress } = await req.json();

    if (!dydxAddress) {
      return new Response(
        JSON.stringify({ error: 'dydxAddress required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[sync-dydx-positions] Syncing positions for', dydxAddress);

    // Fetch positions from dYdX Indexer API
    const indexerUrl = `https://indexer.dydx.trade/v4/addresses/${dydxAddress}/subaccountNumber/0`;
    const response = await fetch(indexerUrl);

    if (!response.ok) {
      if (response.status === 404) {
        // Account not found or no positions - clear existing positions
        await supabase
          .from('dydx_positions')
          .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('address', dydxAddress)
          .eq('status', 'OPEN');

        return new Response(
          JSON.stringify({ success: true, positions: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Failed to fetch positions: ${response.statusText}`);
    }

    const data = await response.json();
    const openPositions = data.subaccount?.openPerpetualPositions || {};

    console.log('[sync-dydx-positions] Found', Object.keys(openPositions).length, 'positions');

    // Get current positions from DB
    const { data: dbPositions } = await supabase
      .from('dydx_positions')
      .select('*')
      .eq('user_id', user.id)
      .eq('address', dydxAddress)
      .eq('status', 'OPEN');

    const dbPositionsMap = new Map((dbPositions || []).map(p => [p.market, p]));
    const syncedPositions = [];

    // Update or insert positions from Indexer
    for (const [market, posData] of Object.entries(openPositions)) {
      const position: any = posData;
      const size = Math.abs(parseFloat(position.size));
      const side = parseFloat(position.side) === 'LONG' ? 'LONG' : 'SHORT';
      const entryPrice = parseFloat(position.entryPrice);
      const unrealizedPnl = parseFloat(position.unrealizedPnl || '0');
      const realizedPnl = parseFloat(position.realizedPnl || '0');

      // Calculate leverage from position data
      const leverage = parseFloat(position.maxLeverage || '1');

      // Calculate liquidation price (approximate)
      const maintenanceMargin = 0.03; // Default 3%
      const liquidationPrice = side === 'LONG'
        ? entryPrice * (1 - (1 / leverage - maintenanceMargin))
        : entryPrice * (1 + (1 / leverage - maintenanceMargin));

      const existingPosition = dbPositionsMap.get(market);

      if (existingPosition) {
        // Update existing position
        await supabase
          .from('dydx_positions')
          .update({
            size,
            unrealized_pnl: unrealizedPnl,
            realized_pnl: realizedPnl,
            liquidation_price: liquidationPrice,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPosition.id);

        syncedPositions.push({ ...existingPosition, size, unrealized_pnl: unrealizedPnl });
      } else {
        // Insert new position
        const { data: newPosition } = await supabase
          .from('dydx_positions')
          .insert({
            user_id: user.id,
            address: dydxAddress,
            market,
            side,
            size,
            entry_price: entryPrice,
            leverage,
            unrealized_pnl: unrealizedPnl,
            realized_pnl: realizedPnl,
            liquidation_price: liquidationPrice,
            status: 'OPEN',
          })
          .select()
          .single();

        if (newPosition) {
          syncedPositions.push(newPosition);
        }
      }

      dbPositionsMap.delete(market);
    }

    // Close positions that no longer exist in Indexer
    for (const [market, dbPosition] of dbPositionsMap.entries()) {
      await supabase
        .from('dydx_positions')
        .update({
          status: 'CLOSED',
          closed_at: new Date().toISOString(),
        })
        .eq('id', dbPosition.id);

      console.log('[sync-dydx-positions] Closed position:', market);
    }

    console.log('[sync-dydx-positions] Sync complete:', syncedPositions.length, 'positions');

    return new Response(
      JSON.stringify({
        success: true,
        positions: syncedPositions,
        synced: syncedPositions.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-dydx-positions] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
