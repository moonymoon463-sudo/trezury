import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SKIP_STATUS_API = 'https://api.skip.build/v2/tx/status';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    console.log('[monitor-skip-deposits] Starting deposit monitoring...');

    // Get all processing deposits with Skip route IDs
    const { data: pendingDeposits, error: queryError } = await supabase
      .from('transactions')
      .select('id, user_id, tx_hash, metadata')
      .eq('type', 'transfer')
      .eq('status', 'processing')
      .not('metadata->skip_route_id', 'is', null);

    if (queryError) {
      console.error('[monitor-skip-deposits] Query error:', queryError);
      throw queryError;
    }

    console.log(`[monitor-skip-deposits] Found ${pendingDeposits?.length || 0} pending deposits`);

    if (!pendingDeposits || pendingDeposits.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending deposits to monitor' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let completedCount = 0;
    let failedCount = 0;

    // Check status for each deposit
    for (const deposit of pendingDeposits) {
      try {
        const metadata = deposit.metadata as any;
        const txHash = deposit.tx_hash;
        const routeId = metadata.skip_route_id;

        if (!txHash || !routeId) {
          console.warn('[monitor-skip-deposits] Missing txHash or routeId:', deposit.id);
          continue;
        }

        // Query Skip status API
        const statusUrl = `${SKIP_STATUS_API}?chain_id=1&tx_hash=${txHash}`;
        const statusResponse = await fetch(statusUrl);

        if (!statusResponse.ok) {
          console.error('[monitor-skip-deposits] Skip API error:', await statusResponse.text());
          continue;
        }

        const status = await statusResponse.json();
        console.log('[monitor-skip-deposits] Status for', deposit.id, ':', status.state);

        // Update based on status
        if (status.state === 'STATE_COMPLETED_SUCCESS') {
          // Mark as completed
          await supabase
            .from('transactions')
            .update({
              status: 'completed',
              metadata: {
                ...metadata,
                completed_at: new Date().toISOString(),
                skip_status: status.state,
                bridge_duration_actual: status.transfer_sequence?.[0]?.axelar_transfer_info?.duration_seconds || null
              }
            })
            .eq('id', deposit.id);

          completedCount++;
          console.log('[monitor-skip-deposits] ✅ Deposit completed:', deposit.id);

        } else if (status.state === 'STATE_COMPLETED_ERROR' || status.state === 'STATE_ABANDONED') {
          // Mark as failed
          await supabase
            .from('transactions')
            .update({
              status: 'failed',
              metadata: {
                ...metadata,
                failed_at: new Date().toISOString(),
                skip_status: status.state,
                error_message: status.error?.message || 'Bridge failed'
              }
            })
            .eq('id', deposit.id);

          failedCount++;
          console.error('[monitor-skip-deposits] ❌ Deposit failed:', deposit.id);

        } else {
          // Still processing - log progress
          console.log('[monitor-skip-deposits] ⏳ Still processing:', deposit.id, status.state);
        }

      } catch (error) {
        console.error('[monitor-skip-deposits] Error processing deposit', deposit.id, ':', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: pendingDeposits.length,
        completed: completedCount,
        failed: failedCount,
        still_processing: pendingDeposits.length - completedCount - failedCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[monitor-skip-deposits] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
