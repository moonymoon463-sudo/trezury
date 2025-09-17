import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// CORS headers
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
    // This endpoint requires service role authentication
    // Only accessible via backend calls with service role key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Admin access required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'GET') {
      // Fetch comprehensive pool statistics for admin dashboard
      const { data: poolStats, error: poolError } = await supabaseAdmin
        .from('pool_stats')
        .select('*')
        .order('chain', { ascending: true });

      if (poolError) {
        console.error('Error fetching pool stats:', poolError);
        return new Response(JSON.stringify({ error: 'Failed to fetch pool statistics' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch aggregate lending metrics
      const { data: totalLocks, error: locksError } = await supabaseAdmin
        .from('locks')
        .select('amount_dec, status, chain, token')
        .eq('status', 'active');

      if (locksError) {
        console.error('Error fetching locks:', locksError);
      }

      // Calculate totals
      const totalValueLocked = (totalLocks || []).reduce((sum, lock) => sum + (lock.amount_dec || 0), 0);
      const activeLocksCount = (totalLocks || []).length;

      const response = {
        poolStats: poolStats || [],
        aggregates: {
          totalValueLocked,
          activeLocksCount,
          totalPools: (poolStats || []).length
        },
        timestamp: new Date().toISOString()
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-dashboard function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});