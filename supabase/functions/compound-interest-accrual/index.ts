import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccrualResult {
  user_id: string;
  asset: string;
  chain: string;
  old_amount: number;
  new_amount: number;
  accrued_interest: number;
  type: 'supply' | 'borrow';
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

    console.log('Starting compound interest accrual process');

    const results: AccrualResult[] = [];
    const currentTime = new Date();

    // Process supplies first
    const { data: supplies } = await supabaseAdmin
      .from('user_supplies')
      .select('*')
      .gt('supplied_amount_dec', 0);

    if (supplies) {
      for (const supply of supplies) {
        try {
          // Get current supply rate for this asset
          const { data: poolReserve } = await supabaseAdmin
            .from('pool_reserves')
            .select('supply_rate')
            .eq('chain', supply.chain)
            .eq('asset', supply.asset)
            .single();

          if (!poolReserve || !poolReserve.supply_rate) continue;

          // Calculate time elapsed since last update (in hours)
          const lastUpdate = new Date(supply.last_interest_update || supply.created_at);
          const hoursElapsed = (currentTime.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

          if (hoursElapsed < 1) continue; // Skip if less than 1 hour

          // Calculate compound interest: A = P(1 + r/n)^(nt)
          // Where n = 8760 (hourly compounding), t = hours elapsed / 8760
          const annualRate = poolReserve.supply_rate;
          const compoundingFrequency = 8760; // Hourly compounding
          const timeInYears = hoursElapsed / 8760;
          
          const compoundFactor = Math.pow(
            1 + (annualRate / compoundingFrequency),
            compoundingFrequency * timeInYears
          );

          const oldAmount = supply.supplied_amount_dec;
          const newAmount = oldAmount * compoundFactor;
          const accruedInterest = newAmount - oldAmount;

          // Update the supply record
          await supabaseAdmin
            .from('user_supplies')
            .update({
              supplied_amount_dec: newAmount,
              accrued_interest_dec: (supply.accrued_interest_dec || 0) + accruedInterest,
              last_interest_update: currentTime.toISOString()
            })
            .eq('id', supply.id);

          results.push({
            user_id: supply.user_id,
            asset: supply.asset,
            chain: supply.chain,
            old_amount: oldAmount,
            new_amount: newAmount,
            accrued_interest: accruedInterest,
            type: 'supply'
          });

          console.log(`Accrued ${accruedInterest.toFixed(6)} ${supply.asset} for user ${supply.user_id} (supply)`);

        } catch (error) {
          console.error(`Error processing supply ${supply.id}:`, error);
        }
      }
    }

    // Process borrows
    const { data: borrows } = await supabaseAdmin
      .from('user_borrows')
      .select('*')
      .gt('borrowed_amount_dec', 0);

    if (borrows) {
      for (const borrow of borrows) {
        try {
          // Get current borrow rate for this asset
          const { data: poolReserve } = await supabaseAdmin
            .from('pool_reserves')
            .select('borrow_rate_variable, borrow_rate_stable')
            .eq('chain', borrow.chain)
            .eq('asset', borrow.asset)
            .single();

          if (!poolReserve) continue;

          const borrowRate = borrow.rate_mode === 'stable' 
            ? poolReserve.borrow_rate_stable 
            : poolReserve.borrow_rate_variable;

          if (!borrowRate) continue;

          // Calculate time elapsed since last update (in hours)
          const lastUpdate = new Date(borrow.last_interest_update || borrow.created_at);
          const hoursElapsed = (currentTime.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

          if (hoursElapsed < 1) continue; // Skip if less than 1 hour

          // Calculate compound interest for debt
          const annualRate = borrowRate;
          const compoundingFrequency = 8760; // Hourly compounding
          const timeInYears = hoursElapsed / 8760;
          
          const compoundFactor = Math.pow(
            1 + (annualRate / compoundingFrequency),
            compoundingFrequency * timeInYears
          );

          const oldAmount = borrow.borrowed_amount_dec;
          const newAmount = oldAmount * compoundFactor;
          const accruedInterest = newAmount - oldAmount;

          // Update the borrow record
          await supabaseAdmin
            .from('user_borrows')
            .update({
              borrowed_amount_dec: newAmount,
              accrued_interest_dec: (borrow.accrued_interest_dec || 0) + accruedInterest,
              last_interest_update: currentTime.toISOString()
            })
            .eq('id', borrow.id);

          results.push({
            user_id: borrow.user_id,
            asset: borrow.asset,
            chain: borrow.chain,
            old_amount: oldAmount,
            new_amount: newAmount,
            accrued_interest: accruedInterest,
            type: 'borrow'
          });

          console.log(`Accrued ${accruedInterest.toFixed(6)} ${borrow.asset} debt for user ${borrow.user_id} (borrow)`);

        } catch (error) {
          console.error(`Error processing borrow ${borrow.id}:`, error);
        }
      }
    }

    // Update pool reserves totals
    const assetChainPairs = new Set(results.map(r => `${r.asset}-${r.chain}`));
    
    for (const pair of assetChainPairs) {
      const [asset, chain] = pair.split('-');
      
      try {
        // Recalculate totals
        const [{ data: totalSupplies }, { data: totalBorrows }] = await Promise.all([
          supabaseAdmin
            .from('user_supplies')
            .select('supplied_amount_dec')
            .eq('asset', asset)
            .eq('chain', chain),
          supabaseAdmin
            .from('user_borrows')
            .select('borrowed_amount_dec')
            .eq('asset', asset)
            .eq('chain', chain)
        ]);

        const totalSupply = totalSupplies?.reduce((sum, s) => sum + s.supplied_amount_dec, 0) || 0;
        const totalBorrowed = totalBorrows?.reduce((sum, b) => sum + b.borrowed_amount_dec, 0) || 0;
        const availableLiquidity = totalSupply - totalBorrowed;
        const utilization = totalSupply > 0 ? totalBorrowed / totalSupply : 0;

        await supabaseAdmin
          .from('pool_reserves')
          .update({
            total_supply_dec: totalSupply,
            total_borrowed_dec: totalBorrowed,
            available_liquidity_dec: availableLiquidity,
            utilization_rate: utilization,
            last_update_timestamp: currentTime.toISOString()
          })
          .eq('asset', asset)
          .eq('chain', chain);

        console.log(`Updated pool totals for ${asset} on ${chain}: Supply ${totalSupply.toFixed(2)}, Borrowed ${totalBorrowed.toFixed(2)}`);

      } catch (error) {
        console.error(`Error updating pool totals for ${asset} on ${chain}:`, error);
      }
    }

    console.log(`Compound interest accrual completed. Processed ${results.length} positions.`);

    return new Response(JSON.stringify({
      success: true,
      processed_positions: results.length,
      accrual_results: results,
      processed_at: currentTime.toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in compound-interest-accrual function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});