import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BorrowRepayRequest {
  action: 'borrow' | 'repay';
  asset: string;
  amount: number;
  rateMode: 'variable' | 'stable';
  chain?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from request
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authorization.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const { action, asset, amount, rateMode, chain = 'ethereum' }: BorrowRepayRequest = await req.json();

    console.log(`Processing ${action} request:`, { userId: user.id, asset, amount, rateMode, chain });

    // Get pool reserve data
    const { data: poolReserve, error: poolError } = await supabaseClient
      .from('pool_reserves')
      .select('*')
      .eq('asset', asset)
      .eq('chain', chain)
      .single();

    if (poolError || !poolReserve) {
      throw new Error(`Pool reserve not found for ${asset} on ${chain}`);
    }

    if (!poolReserve.is_active || !poolReserve.borrowing_enabled) {
      throw new Error(`Borrowing is not enabled for ${asset}`);
    }

    if (rateMode === 'stable' && !poolReserve.stable_rate_enabled) {
      throw new Error(`Stable rate borrowing is not enabled for ${asset}`);
    }

    if (action === 'borrow') {
      // Handle borrow operation
      console.log('Processing borrow operation');

      // Check available liquidity
      if (amount > parseFloat(poolReserve.available_liquidity_dec)) {
        throw new Error('Insufficient liquidity in the pool');
      }

      // Get user's current health factor
      const { data: healthFactor } = await supabaseClient
        .from('user_health_factors')
        .select('*')
        .eq('user_id', user.id)
        .eq('chain', chain)
        .single();

      if (!healthFactor) {
        throw new Error('User has no collateral supplied');
      }

      // Check if user can borrow this amount
      if (amount > healthFactor.available_borrow_usd) {
        throw new Error('Insufficient borrowing power');
      }

      // Check if user already has a borrow position for this asset and rate mode
      const { data: existingBorrow } = await supabaseClient
        .from('user_borrows')
        .select('*')
        .eq('user_id', user.id)
        .eq('asset', asset)
        .eq('chain', chain)
        .eq('rate_mode', rateMode)
        .single();

      const borrowRate = rateMode === 'variable' ? 
        poolReserve.borrow_rate_variable : 
        poolReserve.borrow_rate_stable;

      if (existingBorrow) {
        // Update existing borrow position
        const newAmount = parseFloat(existingBorrow.borrowed_amount_dec) + amount;
        const { error: updateError } = await supabaseClient
          .from('user_borrows')
          .update({
            borrowed_amount_dec: newAmount,
            borrow_rate_at_creation: borrowRate,
            last_interest_update: new Date().toISOString()
          })
          .eq('id', existingBorrow.id);

        if (updateError) throw updateError;
      } else {
        // Create new borrow position
        const { error: insertError } = await supabaseClient
          .from('user_borrows')
          .insert({
            user_id: user.id,
            asset,
            chain,
            borrowed_amount_dec: amount,
            rate_mode: rateMode,
            borrow_rate_at_creation: borrowRate
          });

        if (insertError) throw insertError;
      }

      // Update pool reserves
      const newTotalBorrowed = parseFloat(poolReserve.total_borrowed_dec) + amount;
      const newAvailableLiquidity = parseFloat(poolReserve.available_liquidity_dec) - amount;
      const newUtilizationRate = parseFloat(poolReserve.total_supply_dec) > 0 ? 
        newTotalBorrowed / parseFloat(poolReserve.total_supply_dec) : 0;

      // Calculate new interest rates based on utilization
      const newBorrowRate = calculateBorrowRate(newUtilizationRate, asset);
      const newSupplyRate = newBorrowRate * newUtilizationRate * (1 - poolReserve.reserve_factor);

      const { error: poolUpdateError } = await supabaseClient
        .from('pool_reserves')
        .update({
          total_borrowed_dec: newTotalBorrowed,
          available_liquidity_dec: newAvailableLiquidity,
          utilization_rate: newUtilizationRate,
          supply_rate: newSupplyRate,
          borrow_rate_variable: newBorrowRate,
          last_update_timestamp: new Date().toISOString()
        })
        .eq('id', poolReserve.id);

      if (poolUpdateError) throw poolUpdateError;

      // Update user balance (user receives the borrowed asset)
      await supabaseClient
        .from('balance_snapshots')
        .insert({
          user_id: user.id,
          asset,
          amount: amount, // Positive because user receives borrowed funds
          snapshot_at: new Date().toISOString()
        });

    } else if (action === 'repay') {
      // Handle repay operation
      console.log('Processing repay operation');

      // Get user's borrow position
      const { data: userBorrow, error: borrowError } = await supabaseClient
        .from('user_borrows')
        .select('*')
        .eq('user_id', user.id)
        .eq('asset', asset)
        .eq('chain', chain)
        .eq('rate_mode', rateMode)
        .single();

      if (borrowError || !userBorrow) {
        throw new Error('No borrow position found for this asset and rate mode');
      }

      const currentBorrowed = parseFloat(userBorrow.borrowed_amount_dec);
      const repayAmount = Math.min(amount, currentBorrowed); // Can't repay more than borrowed

      // Update user borrow position
      const newBorrowedAmount = currentBorrowed - repayAmount;
      
      if (newBorrowedAmount === 0) {
        // Remove borrow position if fully repaid
        const { error: deleteError } = await supabaseClient
          .from('user_borrows')
          .delete()
          .eq('id', userBorrow.id);

        if (deleteError) throw deleteError;
      } else {
        // Update borrow position
        const { error: updateError } = await supabaseClient
          .from('user_borrows')
          .update({
            borrowed_amount_dec: newBorrowedAmount,
            last_interest_update: new Date().toISOString()
          })
          .eq('id', userBorrow.id);

        if (updateError) throw updateError;
      }

      // Update pool reserves
      const newTotalBorrowed = parseFloat(poolReserve.total_borrowed_dec) - repayAmount;
      const newAvailableLiquidity = parseFloat(poolReserve.available_liquidity_dec) + repayAmount;
      const newUtilizationRate = parseFloat(poolReserve.total_supply_dec) > 0 ? 
        newTotalBorrowed / parseFloat(poolReserve.total_supply_dec) : 0;

      // Calculate new interest rates
      const newBorrowRate = calculateBorrowRate(newUtilizationRate, asset);
      const newSupplyRate = newBorrowRate * newUtilizationRate * (1 - poolReserve.reserve_factor);

      const { error: poolUpdateError } = await supabaseClient
        .from('pool_reserves')
        .update({
          total_borrowed_dec: newTotalBorrowed,
          available_liquidity_dec: newAvailableLiquidity,
          utilization_rate: newUtilizationRate,
          supply_rate: newSupplyRate,
          borrow_rate_variable: newBorrowRate,
          last_update_timestamp: new Date().toISOString()
        })
        .eq('id', poolReserve.id);

      if (poolUpdateError) throw poolUpdateError;

      // Update user balance (user pays back the asset)
      await supabaseClient
        .from('balance_snapshots')
        .insert({
          user_id: user.id,
          asset,
          amount: -repayAmount, // Negative because user is paying back
          snapshot_at: new Date().toISOString()
        });
    }

    // Recalculate and update user health factor
    await updateUserHealthFactor(supabaseClient, user.id, chain);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${action} operation completed successfully`,
        amount,
        asset,
        rateMode,
        chain
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`Error in borrow-repay function:`, error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function calculateBorrowRate(utilizationRate: number, asset: string): number {
  // Simplified interest rate model
  const baseRate = 0.02; // 2% base rate
  const slope1 = 0.05;    // 5% slope before optimal
  const slope2 = 1.0;     // 100% slope after optimal
  const optimalUtilization = 0.8; // 80% optimal utilization

  if (utilizationRate <= optimalUtilization) {
    return baseRate + (utilizationRate / optimalUtilization) * slope1;
  } else {
    return baseRate + slope1 + ((utilizationRate - optimalUtilization) / (1 - optimalUtilization)) * slope2;
  }
}

async function updateUserHealthFactor(supabaseClient: any, userId: string, chain: string) {
  try {
    // Get user supplies (collateral)
    const { data: supplies } = await supabaseClient
      .from('user_supplies')
      .select('*, pool_reserves!inner(*)')
      .eq('user_id', userId)
      .eq('chain', chain)
      .eq('used_as_collateral', true);

    // Get user borrows (debt)
    const { data: borrows } = await supabaseClient
      .from('user_borrows')
      .select('*, pool_reserves!inner(*)')
      .eq('user_id', userId)
      .eq('chain', chain);

    let totalCollateralUsd = 0;
    let totalDebtUsd = 0;
    let weightedLtv = 0;
    let weightedLiquidationThreshold = 0;

    // Calculate total collateral value
    if (supplies) {
      for (const supply of supplies) {
        const usdValue = parseFloat(supply.supplied_amount_dec);
        totalCollateralUsd += usdValue;
        weightedLtv += usdValue * parseFloat(supply.pool_reserves.ltv);
        weightedLiquidationThreshold += usdValue * parseFloat(supply.pool_reserves.liquidation_threshold);
      }
    }

    // Calculate total debt value
    if (borrows) {
      for (const borrow of borrows) {
        totalDebtUsd += parseFloat(borrow.borrowed_amount_dec);
      }
    }

    // Calculate health factor
    let healthFactor = 999; // Default to very high if no debt
    if (totalDebtUsd > 0 && totalCollateralUsd > 0) {
      const avgLiquidationThreshold = weightedLiquidationThreshold / totalCollateralUsd;
      healthFactor = (totalCollateralUsd * avgLiquidationThreshold) / totalDebtUsd;
    }

    const avgLtv = totalCollateralUsd > 0 ? weightedLtv / totalCollateralUsd : 0;
    const availableBorrowUsd = Math.max(0, totalCollateralUsd * avgLtv - totalDebtUsd);

    // Upsert health factor
    await supabaseClient
      .from('user_health_factors')
      .upsert({
        user_id: userId,
        chain,
        health_factor: healthFactor,
        total_collateral_usd: totalCollateralUsd,
        total_debt_usd: totalDebtUsd,
        available_borrow_usd: availableBorrowUsd,
        ltv: totalDebtUsd > 0 ? totalDebtUsd / totalCollateralUsd : 0,
        liquidation_threshold: avgLiquidationThreshold || 0,
        last_calculated_at: new Date().toISOString()
      });

  } catch (error) {
    console.error('Error updating health factor:', error);
  }
}