import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting automated interest accrual...');

    // Call the compound interest accrual function
    const { error: accrualError } = await supabase.rpc('accrue_compound_interest');
    
    if (accrualError) {
      console.error('Error in interest accrual:', accrualError);
      throw accrualError;
    }

    // Update interest rates based on current utilization
    const { data: poolReserves, error: poolError } = await supabase
      .from('pool_reserves')
      .select('*');

    if (poolError) {
      console.error('Error fetching pool reserves:', poolError);
      throw poolError;
    }

    let updatedPools = 0;
    
    for (const pool of poolReserves || []) {
      // Get current utilization rate
      const utilization = pool.total_supply_dec > 0 
        ? pool.total_borrowed_dec / pool.total_supply_dec 
        : 0;

      // Get interest rate model
      const { data: rateModel } = await supabase
        .from('interest_rate_models')
        .select('*')
        .eq('asset', pool.asset)
        .eq('chain', pool.chain)
        .maybeSingle();

      if (rateModel) {
        let variableBorrowRate: number;
        let supplyRate: number;

        if (utilization <= rateModel.optimal_utilization_rate) {
          // Below optimal utilization
          variableBorrowRate = rateModel.base_variable_borrow_rate + 
            (utilization / rateModel.optimal_utilization_rate) * rateModel.variable_rate_slope1;
        } else {
          // Above optimal utilization
          const excessUtilization = utilization - rateModel.optimal_utilization_rate;
          variableBorrowRate = rateModel.base_variable_borrow_rate + 
            rateModel.variable_rate_slope1 +
            (excessUtilization / (1 - rateModel.optimal_utilization_rate)) * rateModel.variable_rate_slope2;
        }

        // Supply rate calculation (with reserve factor)
        supplyRate = variableBorrowRate * utilization * (1 - pool.reserve_factor);

        // Stable borrow rate calculation
        const stableBorrowRate = rateModel.base_stable_borrow_rate + rateModel.stable_rate_slope1;

        // Update pool reserves with new rates
        const { error: updateError } = await supabase
          .from('pool_reserves')
          .update({
            supply_rate: supplyRate,
            borrow_rate_variable: variableBorrowRate,
            borrow_rate_stable: stableBorrowRate,
            utilization_rate: utilization,
            last_update_timestamp: new Date().toISOString()
          })
          .eq('id', pool.id);

        if (!updateError) {
          updatedPools++;
        }
      }
    }

    // Distribute governance rewards (weekly)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hourOfDay = now.getHours();
    
    // Run rewards distribution on Sundays at midnight UTC
    if (dayOfWeek === 0 && hourOfDay === 0) {
      console.log('Distributing weekly governance rewards...');
      const { error: rewardsError } = await supabase.rpc('distribute_governance_rewards');
      
      if (rewardsError) {
        console.error('Error distributing rewards:', rewardsError);
      } else {
        console.log('Governance rewards distributed successfully');
      }
    }

    console.log(`Accrual completed. Updated ${updatedPools} pools.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Interest accrual completed. Updated ${updatedPools} pools.`,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in auto-accrual function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});