import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Asset price feeds (in production, this would connect to oracles)
const ASSET_PRICES = {
  USDC: 1.0,
  USDT: 1.0,
  DAI: 1.0,
  XAUT: 2345.67, // Will be updated from metals-price-api
  AURU: 150.0
};

// Liquidation parameters
const LIQUIDATION_PARAMS = {
  USDC: { ltv: 0.8, liquidationThreshold: 0.85, liquidationBonus: 0.05 },
  USDT: { ltv: 0.8, liquidationThreshold: 0.85, liquidationBonus: 0.05 },
  DAI: { ltv: 0.75, liquidationThreshold: 0.8, liquidationBonus: 0.08 },
  XAUT: { ltv: 0.7, liquidationThreshold: 0.75, liquidationBonus: 0.1 },
  AURU: { ltv: 0.6, liquidationThreshold: 0.65, liquidationBonus: 0.15 }
};

interface HealthFactorResult {
  user_id: string;
  chain: string;
  health_factor: number;
  total_collateral_usd: number;
  total_debt_usd: number;
  ltv: number;
  risk_level: 'safe' | 'warning' | 'danger' | 'liquidation';
  available_borrow_usd: number;
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

    console.log('Starting health factor monitoring');

    // Update XAUT price from live data
    try {
      const { data: priceData } = await supabaseAdmin.functions.invoke('metals-price-api');
      if (priceData?.gold?.usd_per_oz) {
        ASSET_PRICES.XAUT = priceData.gold.usd_per_oz;
        console.log(`Updated XAUT price to $${ASSET_PRICES.XAUT}`);
      }
    } catch (error) {
      console.log('Could not fetch live XAUT price, using fallback:', error);
    }

    const results: HealthFactorResult[] = [];
    const alerts: any[] = [];

    // Get all users with positions
    const { data: usersWithPositions } = await supabaseAdmin
      .from('user_supplies')
      .select('user_id, chain')
      .gt('supplied_amount_dec', 0);

    if (!usersWithPositions) {
      return new Response(JSON.stringify({ message: 'No users with positions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get unique user-chain combinations
    const uniqueUserChains = Array.from(
      new Set(usersWithPositions.map(u => `${u.user_id}-${u.chain}`))
    ).map(uc => {
      const [user_id, chain] = uc.split('-');
      return { user_id, chain };
    });

    console.log(`Processing ${uniqueUserChains.length} user-chain combinations`);

    for (const { user_id, chain } of uniqueUserChains) {
      try {
        // Get user's supplies and borrows
        const [suppliesRes, borrowsRes] = await Promise.all([
          supabaseAdmin
            .from('user_supplies')
            .select('*')
            .eq('user_id', user_id)
            .eq('chain', chain)
            .gt('supplied_amount_dec', 0),
          supabaseAdmin
            .from('user_borrows')
            .select('*')
            .eq('user_id', user_id)
            .eq('chain', chain)
            .gt('borrowed_amount_dec', 0)
        ]);

        const supplies = suppliesRes.data || [];
        const borrows = borrowsRes.data || [];

        if (supplies.length === 0 && borrows.length === 0) continue;

        // Calculate collateral value
        let totalCollateralUsd = 0;
        let weightedCollateralUsd = 0; // Used for health factor calculation

        for (const supply of supplies) {
          const asset = supply.asset;
          const amount = supply.supplied_amount_dec;
          const price = ASSET_PRICES[asset as keyof typeof ASSET_PRICES] || 0;
          const params = LIQUIDATION_PARAMS[asset as keyof typeof LIQUIDATION_PARAMS];
          
          const valueUsd = amount * price;
          totalCollateralUsd += valueUsd;
          
          if (params) {
            weightedCollateralUsd += valueUsd * params.liquidationThreshold;
          }
        }

        // Calculate debt value
        let totalDebtUsd = 0;

        for (const borrow of borrows) {
          const asset = borrow.asset;
          const amount = borrow.borrowed_amount_dec;
          const price = ASSET_PRICES[asset as keyof typeof ASSET_PRICES] || 0;
          
          totalDebtUsd += amount * price;
        }

        // Calculate health factor
        let healthFactor = 999; // Safe default
        if (totalDebtUsd > 0) {
          healthFactor = weightedCollateralUsd / totalDebtUsd;
        }

        // Calculate LTV
        const ltv = totalCollateralUsd > 0 ? totalDebtUsd / totalCollateralUsd : 0;

        // Calculate available borrow amount
        let availableBorrowUsd = 0;
        for (const supply of supplies) {
          const asset = supply.asset;
          const amount = supply.supplied_amount_dec;
          const price = ASSET_PRICES[asset as keyof typeof ASSET_PRICES] || 0;
          const params = LIQUIDATION_PARAMS[asset as keyof typeof LIQUIDATION_PARAMS];
          
          if (params) {
            availableBorrowUsd += amount * price * params.ltv;
          }
        }
        availableBorrowUsd = Math.max(0, availableBorrowUsd - totalDebtUsd);

        // Determine risk level
        let riskLevel: HealthFactorResult['risk_level'] = 'safe';
        if (healthFactor < 1.0) {
          riskLevel = 'liquidation';
        } else if (healthFactor < 1.1) {
          riskLevel = 'danger';
        } else if (healthFactor < 1.3) {
          riskLevel = 'warning';
        }

        const result: HealthFactorResult = {
          user_id,
          chain,
          health_factor: healthFactor,
          total_collateral_usd: totalCollateralUsd,
          total_debt_usd: totalDebtUsd,
          ltv,
          risk_level: riskLevel,
          available_borrow_usd: availableBorrowUsd
        };

        results.push(result);

        // Update user_health_factors table
        await supabaseAdmin
          .from('user_health_factors')
          .upsert({
            user_id,
            chain,
            health_factor: healthFactor,
            total_collateral_usd: totalCollateralUsd,
            total_debt_usd: totalDebtUsd,
            ltv,
            liquidation_threshold: 0.85, // Average threshold
            available_borrow_usd: availableBorrowUsd,
            last_calculated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,chain'
          });

        // Generate risk alerts for dangerous positions
        if (riskLevel === 'danger' || riskLevel === 'liquidation') {
          const alertMessage = riskLevel === 'liquidation' 
            ? `URGENT: Your position is at risk of liquidation. Health factor: ${healthFactor.toFixed(3)}`
            : `WARNING: Your health factor is low (${healthFactor.toFixed(3)}). Consider reducing borrowed amounts.`;

          await supabaseAdmin
            .from('risk_alerts')
            .insert({
              user_id,
              alert_type: riskLevel === 'liquidation' ? 'liquidation_risk' : 'health_factor_warning',
              severity: riskLevel === 'liquidation' ? 'critical' : 'high',
              message: alertMessage,
              metadata: {
                health_factor: healthFactor,
                chain,
                total_debt: totalDebtUsd,
                total_collateral: totalCollateralUsd,
                ltv
              }
            });

          alerts.push({
            user_id,
            risk_level: riskLevel,
            health_factor: healthFactor,
            message: alertMessage
          });

          console.log(`Generated ${riskLevel} alert for user ${user_id}: HF ${healthFactor.toFixed(3)}`);
        }

      } catch (error) {
        console.error(`Error processing user ${user_id} on ${chain}:`, error);
      }
    }

    console.log(`Health factor monitoring completed. Processed ${results.length} positions, generated ${alerts.length} alerts.`);

    return new Response(JSON.stringify({
      success: true,
      processed_users: results.length,
      alerts_generated: alerts.length,
      results: results.slice(0, 20), // Return first 20 for brevity
      alerts,
      asset_prices_used: ASSET_PRICES,
      processed_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in health-factor-monitor function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});