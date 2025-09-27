import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecurityEvent {
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  user_id?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

interface ActivityAnalysis {
  user_id: string;
  activity: string;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, ...data } = await req.json();

    if (action === 'log_event') {
      return await handleLogEvent(supabaseClient, data as SecurityEvent, req);
    } else if (action === 'analyze_activity') {
      return await handleActivityAnalysis(supabaseClient, data as ActivityAnalysis, req);
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

async function handleLogEvent(supabase: any, event: SecurityEvent, req: Request): Promise<Response> {
  try {
    const sessionId = crypto.randomUUID();
    
    await supabase.from('security_alerts').insert([{
      ...event,
      ip_address: event.ip_address || req.headers.get('x-forwarded-for'),
      user_agent: event.user_agent || req.headers.get('user-agent'),
      metadata: { ...event.metadata, session_id: sessionId }
    }]);

    return new Response(JSON.stringify({ success: true, session_id: sessionId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to log event' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleActivityAnalysis(supabase: any, analysis: ActivityAnalysis, req: Request): Promise<Response> {
  try {
    const { user_id, activity } = analysis;
    let riskScore = 0;
    const reasons: string[] = [];
    
    const { data: recentActivity } = await supabase
      .from('security_alerts')
      .select('created_at')
      .eq('user_id', user_id)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(20);

    if (recentActivity && recentActivity.length > 10) {
      riskScore += 30;
      reasons.push('High frequency activity');
    }

    const isSuspicious = riskScore >= 30;

    if (isSuspicious) {
      await supabase.from('security_alerts').insert([{
        alert_type: 'suspicious_activity',
        severity: 'medium',
        user_id,
        title: 'Suspicious Activity Detected',
        description: `Unusual activity pattern: ${reasons.join(', ')}`,
        metadata: { activity, risk_score: riskScore, reasons }
      }]);
    }

    return new Response(JSON.stringify({ suspicious: isSuspicious, risk_score: riskScore, reasons }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Analysis failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}