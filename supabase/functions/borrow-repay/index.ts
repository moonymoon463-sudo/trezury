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
  walletAddress?: string;
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

    const { action, asset, amount, rateMode, chain = 'ethereum', walletAddress }: BorrowRepayRequest = await req.json();

    console.log(`Processing ${action} request:`, { userId: user.id, asset, amount, rateMode, chain, walletAddress });

    // Get pool reserve data
    const { data: poolReserve, error: poolError } = await supabaseClient
      .from('pool_reserves')
      .select('*')
      .eq('asset', asset)
      .eq('chain', chain)
      .eq('is_active', true)
      .single();

    if (poolError || !poolReserve) {
      throw new Error(`Pool reserve not found for ${asset} on ${chain}`);
    }

    if (action === 'borrow') {
      console.log('📤 Processing borrow operation...');

      // Check if borrowing is enabled
      if (!poolReserve.borrowing_enabled) {
        throw new Error(`Borrowing is disabled for ${asset}`);
      }

      // Check available liquidity
      if (amount > poolReserve.available_liquidity_dec) {
        throw new Error(`Insufficient liquidity. Available: ${poolReserve.available_liquidity_dec}`);
      }

      // Get user's health factor to check if borrow is allowed
      const { data: healthFactor } = await supabaseClient
        .from('user_health_factors')
        .select('*')
        .eq('user_id', user.id)
        .eq('chain', chain)
        .single();

      if (healthFactor && healthFactor.available_borrow_usd < amount) {
        throw new Error('Insufficient borrowing power. Please add more collateral.');
      }

      // Create or update user borrow position
      const { data: existingBorrow } = await supabaseClient
        .from('user_borrows')
        .select('*')
        .eq('user_id', user.id)
        .eq('asset', asset)
        .eq('chain', chain)
        .eq('rate_mode', rateMode)
        .single();

      const currentRate = rateMode === 'stable' ? poolReserve.borrow_rate_stable : poolReserve.borrow_rate_variable;

      if (existingBorrow) {
        // Update existing borrow
        await supabaseClient
          .from('user_borrows')
          .update({
            borrowed_amount_dec: parseFloat(existingBorrow.borrowed_amount_dec) + amount,
            borrow_rate_at_creation: currentRate,
            last_interest_update: new Date().toISOString()
          })
          .eq('id', existingBorrow.id);
      } else {
        // Create new borrow
        await supabaseClient
          .from('user_borrows')
          .insert({
            user_id: user.id,
            asset,
            chain,
            borrowed_amount_dec: amount,
            rate_mode: rateMode,
            borrow_rate_at_creation: currentRate,
            last_interest_update: new Date().toISOString()
          });
      }

      // Update pool reserves
      await supabaseClient
        .from('pool_reserves')
        .update({
          total_borrowed_dec: parseFloat(poolReserve.total_borrowed_dec) + amount,
          available_liquidity_dec: parseFloat(poolReserve.available_liquidity_dec) - amount,
          utilization_rate: (parseFloat(poolReserve.total_borrowed_dec) + amount) / parseFloat(poolReserve.total_supply_dec),
          last_update_timestamp: new Date().toISOString()
        })
        .eq('id', poolReserve.id);

      // Update user health factor
      await updateUserHealthFactor(supabaseClient, user.id, chain);

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Successfully borrowed ${amount} ${asset}`,
        mode: 'database'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'repay') {
      console.log('📥 Processing repay operation...');

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
        throw new Error(`No borrow position found for ${asset}`);
      }

      const borrowedAmount = parseFloat(userBorrow.borrowed_amount_dec);
      const repayAmount = Math.min(amount, borrowedAmount); // Don't repay more than borrowed

      if (repayAmount <= 0) {
        throw new Error('Invalid repay amount');
      }

      // Update user borrow position
      const newBorrowedAmount = borrowedAmount - repayAmount;
      if (newBorrowedAmount <= 0.01) { // Close position if very small amount left
        await supabaseClient
          .from('user_borrows')
          .delete()
          .eq('id', userBorrow.id);
      } else {
        await supabaseClient
          .from('user_borrows')
          .update({
            borrowed_amount_dec: newBorrowedAmount,
            last_interest_update: new Date().toISOString()
          })
          .eq('id', userBorrow.id);
      }

      // Update pool reserves
      await supabaseClient
        .from('pool_reserves')
        .update({
          total_borrowed_dec: parseFloat(poolReserve.total_borrowed_dec) - repayAmount,
          available_liquidity_dec: parseFloat(poolReserve.available_liquidity_dec) + repayAmount,
          utilization_rate: (parseFloat(poolReserve.total_borrowed_dec) - repayAmount) / parseFloat(poolReserve.total_supply_dec),
          last_update_timestamp: new Date().toISOString()
        })
        .eq('id', poolReserve.id);

      // Update user health factor
      await updateUserHealthFactor(supabaseClient, user.id, chain);

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Successfully repaid ${repayAmount} ${asset}`,
        repaidAmount: repayAmount,
        mode: 'database'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Invalid action: ${action}`);

  } catch (error) {
    console.error('Error in borrow-repay function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Update user health factor after borrow/repay operations
 */
async function updateUserHealthFactor(supabaseClient: any, userId: string, chain: string) {
  try {
    // Get user supplies with pool data
    const { data: supplies } = await supabaseClient
      .from('user_supplies')
      .select(`
        *,
        pool_reserves!inner(asset, chain, ltv, liquidation_threshold)
      `)
      .eq('user_id', userId)
      .eq('chain', chain);

    // Get user borrows
    const { data: borrows } = await supabaseClient
      .from('user_borrows')
      .select('*')
      .eq('user_id', userId)
      .eq('chain', chain);

    let totalCollateralUsd = 0;
    let totalDebtUsd = 0;
    let weightedLtv = 0;
    let weightedLiquidationThreshold = 0;

    // Calculate total collateral value (USD assumption for simplicity)
    if (supplies) {
      for (const supply of supplies) {
        const usdValue = parseFloat(supply.supplied_amount_dec); // Assuming 1:1 USD for demo
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