import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Squid Router status API endpoint
const SQUID_STATUS_API = 'https://v2.api.squidrouter.com/v2/status';
const SQUID_INTEGRATOR_ID = 'trezury-app';

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

    console.log('[monitor-squid-deposits] Starting deposit monitoring...');

    // Get all processing deposits with Squid route IDs
    const { data: pendingDeposits, error: queryError } = await supabase
      .from('transactions')
      .select('id, user_id, tx_hash, metadata')
      .eq('type', 'transfer')
      .eq('status', 'processing')
      .not('metadata->squid_route_id', 'is', null);

    if (queryError) {
      console.error('[monitor-squid-deposits] Query error:', queryError);
      throw queryError;
    }

    console.log(`[monitor-squid-deposits] Found ${pendingDeposits?.length || 0} pending deposits`);

    if (!pendingDeposits || pendingDeposits.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending deposits to monitor' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let completedCount = 0;
    let failedCount = 0;

    // Import ethers for transaction receipt checking
    const { ethers } = await import('https://esm.sh/ethers@6.13.0');
    const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');

    // Check status for each deposit
    for (const deposit of pendingDeposits) {
      try {
        const metadata = deposit.metadata as any;
        const ethTxHash = metadata.eth_tx_hash;
        const squidRouteId = metadata.squid_route_id;

        if (!ethTxHash || !squidRouteId) {
          console.warn('[monitor-squid-deposits] Missing transaction identifiers:', deposit.id);
          continue;
        }

        // Check Ethereum transaction status (standard receipt check)
        let ethTxReceipt = null;
        try {
          ethTxReceipt = await provider.getTransactionReceipt(ethTxHash);
        } catch (error) {
          console.warn('[monitor-squid-deposits] Failed to get ETH tx receipt:', error);
        }

        // Check Squid bridge status
        const squidParams = new URLSearchParams({
          transactionId: deposit.tx_hash,
          fromChainId: "1",
          toChainId: "dydx-mainnet-1",
          integratorId: SQUID_INTEGRATOR_ID
        });

        const squidStatusResponse = await fetch(`${SQUID_STATUS_API}?${squidParams}`);
        
        let squidStatus = null;
        if (squidStatusResponse.ok) {
          squidStatus = await squidStatusResponse.json();
        } else {
          console.warn('[monitor-squid-deposits] Squid API error:', await squidStatusResponse.text());
        }

        console.log('[monitor-squid-deposits] Status for', deposit.id, ':', {
          ethConfirmed: ethTxReceipt?.status === 1,
          squid: squidStatus?.squidTransactionStatus
        });

        // Both must complete successfully
        const ethConfirmed = ethTxReceipt?.status === 1; // 1 = success, 0 = failed
        const squidCompleted = squidStatus?.squidTransactionStatus === 'success';

        if (ethConfirmed && squidCompleted) {
          // Mark as completed
          await supabase
            .from('transactions')
            .update({
              status: 'completed',
              metadata: {
                ...metadata,
                completed_at: new Date().toISOString(),
                squid_status: squidStatus.squidTransactionStatus,
                eth_tx_status: 'confirmed',
                bridge_duration_actual: squidStatus.timespent || null
              }
            })
            .eq('id', deposit.id);

          completedCount++;
          console.log('[monitor-squid-deposits] ✅ Deposit completed:', deposit.id);

        } else if (ethTxReceipt?.status === 0 || squidStatus?.squidTransactionStatus === 'partial_success') {
          // Mark as failed
          await supabase
            .from('transactions')
            .update({
              status: 'failed',
              metadata: {
                ...metadata,
                failed_at: new Date().toISOString(),
                squid_status: squidStatus?.squidTransactionStatus,
                eth_tx_status: ethTxReceipt?.status === 0 ? 'failed' : 'pending',
                error_message: 'Bridge transaction failed'
              }
            })
            .eq('id', deposit.id);

          failedCount++;
          console.error('[monitor-squid-deposits] ❌ Deposit failed:', deposit.id);

        } else {
          // Still processing
          console.log('[monitor-squid-deposits] ⏳ Still processing:', deposit.id);
        }

      } catch (error) {
        console.error('[monitor-squid-deposits] Error processing deposit', deposit.id, ':', error);
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
    console.error('[monitor-squid-deposits] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
