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

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckIntents } = await supabase
      .from('transaction_intents')
      .select('*')
      .in('status', ['pending', 'broadcasting'])
      .lt('created_at', tenMinutesAgo);

    if (!stuckIntents?.length) {
      return new Response(JSON.stringify({ success: true, stuckIntents: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    for (const intent of stuckIntents) {
      const stuckMinutes = Math.floor((Date.now() - new Date(intent.created_at).getTime()) / 60000);
      
      if (stuckMinutes >= 30) {
        await supabase.from('security_alerts').insert({
          alert_type: 'reconciliation_failure',
          severity: 'critical',
          title: 'Swap Intent Critically Stuck',
          description: `Intent ${intent.id} stuck for ${stuckMinutes} minutes`,
          metadata: { intentId: intent.id, stuckMinutes }
        });
      }
    }

    return new Response(JSON.stringify({ success: true, stuckIntents: stuckIntents.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
