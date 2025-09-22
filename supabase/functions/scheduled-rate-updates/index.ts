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

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting scheduled operations...');

    const startTime = Date.now();
    const results = {
      rate_updates: null,
      interest_accrual: null,
      health_factor_monitoring: null,
      errors: []
    };

    // 1. Update real-time rates
    try {
      console.log('Updating real-time rates...');
      const { data: rateData, error: rateError } = await supabaseAdmin.functions.invoke('real-time-rates');
      
      if (rateError) {
        throw new Error(`Rate update failed: ${rateError.message}`);
      }
      
      results.rate_updates = rateData;
      console.log('✓ Rate updates completed');
    } catch (error) {
      console.error('Rate update error:', error);
      results.errors.push(`Rate update: ${error.message}`);
    }

    // 2. Process compound interest accrual
    try {
      console.log('Processing compound interest accrual...');
      const { data: accrualData, error: accrualError } = await supabaseAdmin.functions.invoke('compound-interest-accrual');
      
      if (accrualError) {
        throw new Error(`Interest accrual failed: ${accrualError.message}`);
      }
      
      results.interest_accrual = accrualData;
      console.log('✓ Interest accrual completed');
    } catch (error) {
      console.error('Interest accrual error:', error);
      results.errors.push(`Interest accrual: ${error.message}`);
    }

    // 3. Monitor health factors
    try {
      console.log('Monitoring health factors...');
      const { data: healthData, error: healthError } = await supabaseAdmin.functions.invoke('health-factor-monitor');
      
      if (healthError) {
        throw new Error(`Health factor monitoring failed: ${healthError.message}`);
      }
      
      results.health_factor_monitoring = healthData;
      console.log('✓ Health factor monitoring completed');
    } catch (error) {
      console.error('Health factor monitoring error:', error);
      results.errors.push(`Health factor monitoring: ${error.message}`);
    }

    const executionTime = Date.now() - startTime;
    
    console.log(`Scheduled operations completed in ${executionTime}ms with ${results.errors.length} errors`);

    // Log execution summary
    await supabaseAdmin
      .from('audit_log')
      .insert({
        user_id: null,
        table_name: 'scheduled_operations',
        operation: 'SCHEDULED_UPDATE',
        sensitive_fields: null,
        timestamp: new Date().toISOString(),
        metadata: {
          execution_time_ms: executionTime,
          errors_count: results.errors.length,
          operations_completed: Object.keys(results).filter(k => k !== 'errors' && results[k as keyof typeof results] !== null).length,
          errors: results.errors
        }
      });

    return new Response(JSON.stringify({
      success: true,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        operations_completed: Object.keys(results).filter(k => k !== 'errors' && results[k as keyof typeof results] !== null).length,
        errors_count: results.errors.length,
        successful: results.errors.length === 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Critical error in scheduled operations:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});