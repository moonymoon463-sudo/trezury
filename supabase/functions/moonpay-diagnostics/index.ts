import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment_variables: {
        // Check for MoonPay secrets
        MOONPAY_SECRET_KEY: Deno.env.get('MOONPAY_SECRET_KEY') ? 'Present' : 'Missing',
        MOONPAY_PUBLISHABLE_KEY: Deno.env.get('MOONPAY_PUBLISHABLE_KEY') ? 'Present' : 'Missing',
        MOONPAY_WEBHOOK_SECRET: Deno.env.get('MOONPAY_WEBHOOK_SECRET') ? 'Present' : 'Missing',
        
        // Check for Supabase vars
        SUPABASE_URL: Deno.env.get('SUPABASE_URL') ? 'Present' : 'Missing',
        SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ? 'Present' : 'Missing',
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'Present' : 'Missing',
      },
      moonpay_key_validation: {
        secret_key_format: Deno.env.get('MOONPAY_SECRET_KEY') ? 
          (Deno.env.get('MOONPAY_SECRET_KEY')?.startsWith('sk_') ? 'Valid format' : 'Invalid format - should start with sk_') : 
          'Not available',
        publishable_key_format: Deno.env.get('MOONPAY_PUBLISHABLE_KEY') ? 
          (Deno.env.get('MOONPAY_PUBLISHABLE_KEY')?.startsWith('pk_') ? 'Valid format' : 'Invalid format - should start with pk_') : 
          'Not available',
        webhook_secret_present: Deno.env.get('MOONPAY_WEBHOOK_SECRET') ? 'Yes' : 'No'
      },
      function_status: 'MoonPay diagnostics running successfully'
    };

    console.log('MoonPay Diagnostics Results:', JSON.stringify(diagnostics, null, 2));

    return new Response(
      JSON.stringify(diagnostics, null, 2),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('MoonPay diagnostics error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        function_status: 'Error in diagnostics function'
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});