import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced rate calculation with live market data
const RATE_MODELS = {
  USDC: {
    baseRate: 0.02, // 2%
    rateSlope1: 0.05, // 5% when under optimal utilization
    rateSlope2: 1.0, // 100% when over optimal utilization
    optimalUtilization: 0.8, // 80%
    reserveFactor: 0.1 // 10% reserve
  },
  USDT: {
    baseRate: 0.015,
    rateSlope1: 0.04,
    rateSlope2: 0.75,
    optimalUtilization: 0.8,
    reserveFactor: 0.1
  },
  DAI: {
    baseRate: 0.025,
    rateSlope1: 0.06,
    rateSlope2: 1.2,
    optimalUtilization: 0.75,
    reserveFactor: 0.08
  },
  XAUT: {
    baseRate: 0.03,
    rateSlope1: 0.08,
    rateSlope2: 1.5,
    optimalUtilization: 0.7,
    reserveFactor: 0.15
  },
  AURU: {
    baseRate: 0.05,
    rateSlope1: 0.1,
    rateSlope2: 2.0,
    optimalUtilization: 0.6,
    reserveFactor: 0.05
  }
};

interface RateRequest {
  chain: string;
  asset: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      const { chain, asset }: RateRequest = await req.json();
      
      console.log(`Calculating real-time rates for ${asset} on ${chain}`);

      const rateModel = RATE_MODELS[asset as keyof typeof RATE_MODELS];
      if (!rateModel) {
        return new Response(JSON.stringify({ error: 'Unsupported asset' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get current pool utilization
      const { data: poolStats } = await supabaseAdmin
        .from('pool_reserves')
        .select('total_supply_dec, total_borrowed_dec, utilization_rate')
        .eq('chain', chain)
        .eq('asset', asset)
        .single();

      let utilization = 0;
      if (poolStats && poolStats.total_supply_dec > 0) {
        utilization = poolStats.total_borrowed_dec / poolStats.total_supply_dec;
      }

      // Calculate borrow rate using kinked interest rate model
      let borrowRate: number;
      if (utilization <= rateModel.optimalUtilization) {
        borrowRate = rateModel.baseRate + 
          (utilization / rateModel.optimalUtilization) * rateModel.rateSlope1;
      } else {
        const excessUtilization = (utilization - rateModel.optimalUtilization) / 
          (1 - rateModel.optimalUtilization);
        borrowRate = rateModel.baseRate + rateModel.rateSlope1 + 
          excessUtilization * rateModel.rateSlope2;
      }

      // Calculate supply rate: borrowRate * utilization * (1 - reserveFactor)
      const supplyRate = borrowRate * utilization * (1 - rateModel.reserveFactor);

      // Add market volatility adjustment for XAUT
      let volatilityAdjustment = 0;
      if (asset === 'XAUT') {
        // Fetch recent price data for volatility calculation
        try {
          const { data: priceData, error: priceError } = await supabaseAdmin.functions.invoke('metals-price-api');
          if (!priceError && priceData?.gold?.change_percent_24h) {
            const priceChange = Math.abs(priceData.gold.change_percent_24h);
            volatilityAdjustment = Math.min(priceChange / 100 * 0.5, 0.02); // Cap at 2%
          }
        } catch (error) {
          console.log('Could not fetch price data for volatility adjustment:', error);
        }
      }

      const adjustedBorrowRate = borrowRate + volatilityAdjustment;
      const adjustedSupplyRate = supplyRate;

      // Update pool reserves with new rates
      await supabaseAdmin
        .from('pool_reserves')
        .update({
          supply_rate: adjustedSupplyRate,
          borrow_rate_variable: adjustedBorrowRate,
          utilization_rate: utilization,
          last_update_timestamp: new Date().toISOString()
        })
        .eq('chain', chain)
        .eq('asset', asset);

      console.log(`Updated rates for ${asset}: Supply ${(adjustedSupplyRate * 100).toFixed(2)}%, Borrow ${(adjustedBorrowRate * 100).toFixed(2)}%`);

      return new Response(JSON.stringify({
        asset,
        chain,
        supply_rate: adjustedSupplyRate,
        borrow_rate: adjustedBorrowRate,
        utilization: utilization,
        volatility_adjustment: volatilityAdjustment,
        last_updated: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET request - update all rates
    if (req.method === 'GET') {
      console.log('Updating all real-time rates');
      
      const assets = ['USDC', 'USDT', 'DAI', 'XAUT', 'AURU'];
      const chains = ['ethereum'];
      const results = [];

      for (const chain of chains) {
        for (const asset of assets) {
          try {
            // Self-invoke to calculate rates for each asset
            const response = await fetch(`${req.url}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chain, asset })
            });
            
            if (response.ok) {
              const data = await response.json();
              results.push(data);
            }
          } catch (error) {
            console.error(`Error updating rates for ${asset} on ${chain}:`, error);
          }
        }
      }

      return new Response(JSON.stringify({
        message: 'Rate update completed',
        updated_assets: results.length,
        results: results,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in real-time-rates function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});