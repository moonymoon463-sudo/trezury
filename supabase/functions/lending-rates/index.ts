import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// CORS headers for web app access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lock terms configuration (replicated from frontend types)
const LOCK_TERMS = [
  { days: 30, label: "30 days", apyMin: 3.5, apyMax: 8.0 },
  { days: 90, label: "90 days", apyMin: 4.0, apyMax: 9.0 },
  { days: 180, label: "6 months", apyMin: 4.5, apyMax: 10.0 },
  { days: 365, label: "1 year", apyMin: 5.0, apyMax: 12.0 }
];

interface CalculateAPYRequest {
  chain: string;
  token: string;
  termDays: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key to access pool_stats (admin-only data)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      const { chain, token, termDays }: CalculateAPYRequest = await req.json();

      // Find the term configuration
      const term = LOCK_TERMS.find(t => t.days === termDays);
      if (!term) {
        return new Response(JSON.stringify({ error: 'Invalid lock term' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get pool utilization using admin access
      const { data: poolStats, error } = await supabaseAdmin
        .from('pool_stats')
        .select('total_deposits_dec, total_borrowed_dec')
        .eq('chain', chain)
        .eq('token', token)
        .maybeSingle();

      if (error) {
        console.error('Error fetching pool stats:', error);
        // Return minimum APY if no pool data available
        return new Response(JSON.stringify({ apy: term.apyMin }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let apy = term.apyMin;

      if (poolStats && poolStats.total_deposits_dec > 0) {
        // Calculate APY based on pool utilization
        const utilization = poolStats.total_borrowed_dec / poolStats.total_deposits_dec;
        apy = term.apyMin + Math.min(utilization, 1) * (term.apyMax - term.apyMin);
      }

      // Round to 2 decimal places
      apy = Math.round(apy * 100) / 100;

      return new Response(JSON.stringify({ apy }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET request - return available terms and rate ranges
    if (req.method === 'GET') {
      return new Response(JSON.stringify({ 
        terms: LOCK_TERMS.map(term => ({
          days: term.days,
          label: term.label,
          apyRange: `${term.apyMin}% - ${term.apyMax}%`
        }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in lending-rates function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});