import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getRateLimitHeaders, createRateLimitResponse } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: user.id });
    
    if (!isAdmin) {
      console.warn(`Unauthorized access attempt to trigger-news-collection by user: ${user.id}`);
      await supabase.rpc('log_security_event', {
        event_type: 'unauthorized_admin_function_access',
        event_data: {
          function: 'trigger-news-collection',
          user_id: user.id,
          timestamp: new Date().toISOString()
        }
      });
      
      return new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 2 requests per hour per user
    const rateLimitResult = await checkRateLimit(
      supabaseUrl,
      supabaseKey,
      user.id,
      'trigger-news-collection',
      2,
      3600000
    );

    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for trigger-news-collection by admin: ${user.id}`);
      await supabase.rpc('log_security_event', {
        event_type: 'rate_limit_exceeded',
        event_data: {
          function: 'trigger-news-collection',
          user_id: user.id,
          timestamp: new Date().toISOString()
        }
      });
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    console.log(`🚀 Triggering financial news collection (by admin: ${user.id})...`);

    // Call the financial news collector
    const { data, error } = await supabase.functions.invoke('financial-news-collector', {
      body: { manual_trigger: true }
    });

    if (error) {
      console.error('Error triggering news collection:', error);
      throw error;
    }

    console.log('✅ News collection triggered successfully:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Financial news collection triggered successfully',
        data: data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    console.error('Function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});