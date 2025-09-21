import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// CORS headers for web app access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced APY configuration with sustainable rates
const SUSTAINABLE_APY_CONFIG = {
  baseRates: {
    USDC: { min: 2.0, max: 8.0, platformFeeRate: 0.15 }, // 15% of earned interest
    USDT: { min: 1.5, max: 7.5, platformFeeRate: 0.15 },
    DAI: { min: 2.5, max: 9.0, platformFeeRate: 0.12 }, // Lower fee for decentralized asset
    XAUT: { min: 3.0, max: 12.0, platformFeeRate: 0.18 }, // Higher fee for commodity
    AURU: { min: 5.0, max: 15.0, platformFeeRate: 0.10 } // Lower fee for governance token
  },
  utilizationThresholds: {
    high: 0.8, // 80% utilization
    medium: 0.5 // 50% utilization
  },
  bonusRates: {
    highUtilization: 0.01, // 1% bonus
    mediumUtilization: 0.005, // 0.5% bonus
    governanceBonus: 0.002, // 0.2% for AURU holders
    earlySupplierBonus: 0.015 // 1.5% for early suppliers
  }
};

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

      // Get sustainable APY configuration for the token
      const tokenConfig = SUSTAINABLE_APY_CONFIG.baseRates[token as keyof typeof SUSTAINABLE_APY_CONFIG.baseRates];
      if (!tokenConfig) {
        return new Response(JSON.stringify({ error: 'Unsupported token' }), {
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
        return new Response(JSON.stringify({ apy: tokenConfig.min }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let baseApy = tokenConfig.min;
      let utilization = 0;
      let utilizationBonus = 0;
      let demandBonus = 0;

      if (poolStats && poolStats.total_deposits_dec > 0) {
        // Calculate base APY from utilization
        utilization = poolStats.total_borrowed_dec / poolStats.total_deposits_dec;
        baseApy = tokenConfig.min + Math.min(utilization, 1) * (tokenConfig.max - tokenConfig.min);
        
        // Add utilization bonuses
        if (utilization > SUSTAINABLE_APY_CONFIG.utilizationThresholds.high) {
          utilizationBonus = SUSTAINABLE_APY_CONFIG.bonusRates.highUtilization;
        } else if (utilization > SUSTAINABLE_APY_CONFIG.utilizationThresholds.medium) {
          utilizationBonus = SUSTAINABLE_APY_CONFIG.bonusRates.mediumUtilization;
        }
      }

      // Calculate demand bonus based on recent supply activity
      const { data: recentSupplies } = await supabaseAdmin
        .from('user_supplies')
        .select('supplied_amount_dec')
        .eq('chain', chain)
        .eq('asset', token)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (recentSupplies && recentSupplies.length > 0) {
        const recentVolume = recentSupplies.reduce((sum, supply) => sum + supply.supplied_amount_dec, 0);
        if (recentVolume > 100000) { // $100k+ in last week
          demandBonus = SUSTAINABLE_APY_CONFIG.bonusRates.earlySupplierBonus;
        } else if (recentVolume > 50000) { // $50k+
          demandBonus = SUSTAINABLE_APY_CONFIG.bonusRates.earlySupplierBonus * 0.66;
        } else if (recentVolume > 10000) { // $10k+
          demandBonus = SUSTAINABLE_APY_CONFIG.bonusRates.earlySupplierBonus * 0.33;
        }
      }

      // Calculate gross APY with all bonuses
      const grossApy = baseApy + utilizationBonus + demandBonus;
      
      // Apply dynamic platform fee based on APY performance
      const dynamicPlatformFeeRate = tokenConfig.platformFeeRate * (1 + Math.min(grossApy / 10, 0.5)); // Cap at 50% increase
      const netApy = grossApy * (1 - dynamicPlatformFeeRate);

      // Round to 2 decimal places
      const finalApy = Math.round(netApy * 100) / 100;

      return new Response(JSON.stringify({ 
        apy: Math.round(netApy * 100) / 100,
        gross_apy: Math.round(grossApy * 100) / 100,
        base_apy: Math.round(baseApy * 100) / 100,
        utilization_bonus: Math.round(utilizationBonus * 100) / 100,
        demand_bonus: Math.round(demandBonus * 100) / 100,
        platform_fee_rate: Math.round(dynamicPlatformFeeRate * 100) / 100,
        utilization: Math.round(utilization * 100) / 100,
        recent_volume: recentSupplies?.reduce((sum, supply) => sum + supply.supplied_amount_dec, 0) || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET request - return available tokens and rate ranges
    if (req.method === 'GET') {
      const availableTokens = Object.entries(SUSTAINABLE_APY_CONFIG.baseRates).map(([token, config]) => ({
        token,
        apyRange: `${config.min}% - ${config.max}%`,
        platformFeeRate: `${(config.platformFeeRate * 100).toFixed(1)}%`,
        description: getTokenDescription(token)
      }));

      return new Response(JSON.stringify({ 
        tokens: availableTokens,
        sustainableRates: true,
        lastUpdated: new Date().toISOString()
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

function getTokenDescription(token: string): string {
  const descriptions: Record<string, string> = {
    USDC: 'USD Coin - Fully collateralized US dollar stablecoin',
    USDT: 'Tether USD - Most liquid stablecoin pegged to USD', 
    DAI: 'DAI Stablecoin - Decentralized stable currency',
    XAUT: 'Tether Gold - Digital gold backed by physical gold',
    AURU: 'Aurum Governance Token - Protocol governance and rewards'
  };
  return descriptions[token] || 'Digital asset for lending and borrowing';
}