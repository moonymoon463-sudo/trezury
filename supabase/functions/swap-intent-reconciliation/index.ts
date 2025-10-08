import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message: 'Starting reconciliation' }));

  // Check for stuck validating intents (2 minutes timeout)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: stuckValidatingIntents } = await supabase
    .from('transaction_intents')
    .select('*')
    .eq('status', 'validating')
    .lt('created_at', twoMinutesAgo);

  // Check for stuck pending/broadcasting intents (10 minutes timeout)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: stuckProcessingIntents } = await supabase
    .from('transaction_intents')
    .select('*')
    .in('status', ['pending', 'broadcasting', 'funds_pulled', 'swap_executed', 'requires_reconciliation'])
    .lt('created_at', tenMinutesAgo);

    const allStuckIntents = [...(stuckValidatingIntents || []), ...(stuckProcessingIntents || [])];

    if (!allStuckIntents.length) {
      return new Response(JSON.stringify({ success: true, stuckIntents: 0, failedIntents: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let failedCount = 0;
    for (const intent of allStuckIntents) {
      const stuckMinutes = Math.floor((Date.now() - new Date(intent.created_at).getTime()) / 60000);
      
      console.log(`🔧 Failing stuck intent ${intent.id} (${intent.status}, ${stuckMinutes}m old)`);
      
      // Actually fail the stuck intent
      const { error: updateError } = await supabase
        .from('transaction_intents')
        .update({
          status: 'failed',
          error_message: `Transaction stuck in ${intent.status} status for ${stuckMinutes} minutes and was automatically failed by reconciliation`,
          updated_at: new Date().toISOString()
        })
        .eq('id', intent.id);

      if (updateError) {
        console.error(`❌ Failed to update intent ${intent.id}:`, updateError);
      } else {
        failedCount++;
        console.log(`✅ Successfully failed intent ${intent.id}`);
      }
      
      // Create alert for critical cases (>30 minutes)
      if (stuckMinutes >= 30) {
        await supabase.from('security_alerts').insert({
          alert_type: 'reconciliation_failure',
          severity: 'critical',
          title: 'Swap Intent Critically Stuck',
          description: `Intent ${intent.id} stuck for ${stuckMinutes} minutes and was automatically failed`,
          metadata: { intentId: intent.id, stuckMinutes, status: intent.status }
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      stuckIntents: allStuckIntents.length,
      failedIntents: failedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
