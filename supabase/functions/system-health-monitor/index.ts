import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get system health metrics
    const { data: healthData, error: healthError } = await supabase
      .rpc('get_system_health_metrics');

    if (healthError) {
      throw healthError;
    }

    // Record system capacity metrics
    const now = new Date().toISOString();
    const { error: capacityError } = await supabase
      .from('system_capacity')
      .insert({
        concurrent_users: healthData.active_users || 0,
        active_connections: Math.floor(Math.random() * 100), // Simulated - replace with actual metrics
        cpu_usage_percent: Math.floor(Math.random() * 50) + 10, // Simulated
        memory_usage_percent: Math.floor(Math.random() * 40) + 20, // Simulated
        response_time_ms: healthData.avg_response_time_ms || 0,
        recorded_at: now
      });

    if (capacityError) {
      console.error('Failed to record capacity metrics:', capacityError);
    }

    // Check for alerts
    const alerts = [];
    
    // High user load alert
    if (healthData.active_users > 5000) {
      alerts.push({
        type: 'warning',
        message: `High user load detected: ${healthData.active_users} active users`,
        threshold: 5000,
        actual: healthData.active_users
      });
    }

    // Critical user load alert
    if (healthData.active_users > 8000) {
      alerts.push({
        type: 'critical',
        message: `Critical user load: ${healthData.active_users} active users - consider scaling`,
        threshold: 8000,
        actual: healthData.active_users
      });
    }

    // Response time alerts
    if (healthData.avg_response_time_ms > 500) {
      alerts.push({
        type: healthData.avg_response_time_ms > 1000 ? 'critical' : 'warning',
        message: `High response time: ${healthData.avg_response_time_ms}ms`,
        threshold: 500,
        actual: healthData.avg_response_time_ms
      });
    }

    // Store alerts if any
    if (alerts.length > 0) {
      for (const alert of alerts) {
        await supabase.from('security_alerts').insert({
          alert_type: 'system_performance',
          severity: alert.type,
          title: 'System Performance Alert',
          description: alert.message,
          metadata: {
            threshold: alert.threshold,
            actual_value: alert.actual,
            metric_type: 'system_health',
            auto_generated: true
          }
        });
      }
    }

    // Calculate scaling recommendations
    const scalingRecommendations = [];
    
    if (healthData.active_users > 7000) {
      scalingRecommendations.push({
        action: 'increase_database_connections',
        priority: 'high',
        reason: 'Approaching user capacity limit'
      });
    }

    if (healthData.avg_response_time_ms > 800) {
      scalingRecommendations.push({
        action: 'enable_read_replicas',
        priority: 'medium',
        reason: 'Response times degrading'
      });
    }

    const response = {
      success: true,
      timestamp: now,
      health_data: healthData,
      alerts: alerts,
      scaling_recommendations: scalingRecommendations,
      system_status: {
        capacity_usage: Math.min((healthData.active_users / 10000) * 100, 100),
        performance_grade: healthData.avg_response_time_ms < 200 ? 'A' : 
                          healthData.avg_response_time_ms < 500 ? 'B' : 
                          healthData.avg_response_time_ms < 1000 ? 'C' : 'D',
        overall_health: alerts.some(a => a.type === 'critical') ? 'critical' :
                       alerts.some(a => a.type === 'warning') ? 'warning' : 'healthy'
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('System health monitor error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});