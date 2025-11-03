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

    const { address } = await req.json();

    if (!address) {
      throw new Error('Address is required');
    }

    // Fetch positions from Hyperliquid
    const response = await fetch(`${HYPERLIQUID_API}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'clearinghouseState',
        user: address
      })
    });

    if (!response.ok) {
      throw new Error(`Hyperliquid API error: ${response.statusText}`);
    }

    const accountState = await response.json();
    const positions = accountState.assetPositions || [];

    // Get existing positions from database
    const { data: dbPositions, error: selectError } = await supabaseClient
      .from('hyperliquid_positions')
      .select('*')
      .eq('user_id', user.id)
      .eq('address', address)
      .eq('status', 'OPEN');

    if (selectError) {
      throw selectError;
    }

    const dbPositionMap = new Map(
      (dbPositions || []).map(p => [p.market, p])
    );

    const apiPositionMap = new Map(
      positions
        .filter((p: any) => parseFloat(p.position.szi) !== 0)
        .map((p: any) => [p.position.coin, p])
    );

    // Update or insert positions
    for (const [market, apiPos] of apiPositionMap.entries()) {
      const pos = apiPos.position;
      const szi = parseFloat(pos.szi);
      const side = szi > 0 ? 'LONG' : 'SHORT';
      const size = Math.abs(szi);

      const positionData = {
        user_id: user.id,
        address,
        market,
        side,
        size,
        entry_price: parseFloat(pos.entryPx),
        leverage: size * parseFloat(pos.entryPx) / parseFloat(pos.marginUsed) || 1,
        unrealized_pnl: parseFloat(pos.unrealizedPnl),
        liquidation_price: pos.liquidationPx ? parseFloat(pos.liquidationPx) : null,
        status: 'OPEN'
      };

      if (dbPositionMap.has(market)) {
        // Update existing position
        const { error: updateError } = await supabaseClient
          .from('hyperliquid_positions')
          .update(positionData)
          .eq('id', dbPositionMap.get(market)!.id);

        if (updateError) {
          console.error(`Error updating position for ${market}:`, updateError);
        }
      } else {
        // Insert new position
        const { error: insertError } = await supabaseClient
          .from('hyperliquid_positions')
          .insert(positionData);

        if (insertError) {
          console.error(`Error inserting position for ${market}:`, insertError);
        }
      }
    }

    // Close positions that no longer exist
    for (const [market, dbPos] of dbPositionMap.entries()) {
      if (!apiPositionMap.has(market)) {
        const { error: closeError } = await supabaseClient
          .from('hyperliquid_positions')
          .update({
            status: 'CLOSED',
            closed_at: new Date().toISOString()
          })
          .eq('id', dbPos.id);

        if (closeError) {
          console.error(`Error closing position for ${market}:`, closeError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: apiPositionMap.size,
        closed: Array.from(dbPositionMap.keys()).filter(m => !apiPositionMap.has(m)).length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Sync Hyperliquid positions error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
