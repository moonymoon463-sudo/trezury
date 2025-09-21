import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SupplyWithdrawRequest {
  action: 'supply' | 'withdraw';
  asset: string;
  amount: number;
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

    const { action, asset, amount, chain = 'ethereum' }: SupplyWithdrawRequest = await req.json();

    console.log(`Processing ${action} request:`, { userId: user.id, asset, amount, chain });

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

    if (!poolReserve.is_active) {
      throw new Error(`Pool for ${asset} is currently inactive`);
    }

    if (action === 'supply') {
      // Handle supply operation
      console.log('Processing supply operation');

      // Check if user already has a supply position
      const { data: existingSupply } = await supabaseClient
        .from('user_supplies')
        .select('*')
        .eq('user_id', user.id)
        .eq('asset', asset)
        .eq('chain', chain)
        .single();

      if (existingSupply) {
        // Update existing supply
        const newAmount = parseFloat(existingSupply.supplied_amount_dec) + amount;
        const { error: updateError } = await supabaseClient
          .from('user_supplies')
          .update({
            supplied_amount_dec: newAmount,
            supply_rate_at_deposit: poolReserve.supply_rate,
            last_interest_update: new Date().toISOString()
          })
          .eq('id', existingSupply.id);

        if (updateError) throw updateError;
      } else {
        // Create new supply position
        const { error: insertError } = await supabaseClient
          .from('user_supplies')
          .insert({
            user_id: user.id,
            asset,
            chain,
            supplied_amount_dec: amount,
            supply_rate_at_deposit: poolReserve.supply_rate,
            used_as_collateral: true
          });

        if (insertError) throw insertError;
      }

      // Update pool reserves
      const newTotalSupply = parseFloat(poolReserve.total_supply_dec) + amount;
      const newAvailableLiquidity = parseFloat(poolReserve.available_liquidity_dec) + amount;
      const newUtilizationRate = newTotalSupply > 0 ? 
        parseFloat(poolReserve.total_borrowed_dec) / newTotalSupply : 0;

      const { error: poolUpdateError } = await supabaseClient
        .from('pool_reserves')
        .update({
          total_supply_dec: newTotalSupply,
          available_liquidity_dec: newAvailableLiquidity,
          utilization_rate: newUtilizationRate,
          last_update_timestamp: new Date().toISOString()
        })
        .eq('id', poolReserve.id);

      if (poolUpdateError) throw poolUpdateError;

      // Update user balance
      await supabaseClient
        .from('balance_snapshots')
        .insert({
          user_id: user.id,
          asset,
          amount: -amount, // Negative because user is supplying
          snapshot_at: new Date().toISOString()
        });

    } else if (action === 'withdraw') {
      // Handle withdraw operation
      console.log('Processing withdraw operation');

      // Get user's supply position
      const { data: userSupply, error: supplyError } = await supabaseClient
        .from('user_supplies')
        .select('*')
        .eq('user_id', user.id)
        .eq('asset', asset)
        .eq('chain', chain)
        .single();

      if (supplyError || !userSupply) {
        throw new Error('No supply position found for this asset');
      }

      const currentSupplied = parseFloat(userSupply.supplied_amount_dec);
      if (amount > currentSupplied) {
        throw new Error('Insufficient supplied amount');
      }

      // Check if withdrawal would violate health factor
      // TODO: Implement health factor check

      // Update user supply
      const newSuppliedAmount = currentSupplied - amount;
      
      if (newSuppliedAmount === 0) {
        // Remove supply position if fully withdrawn
        const { error: deleteError } = await supabaseClient
          .from('user_supplies')
          .delete()
          .eq('id', userSupply.id);

        if (deleteError) throw deleteError;
      } else {
        // Update supply position
        const { error: updateError } = await supabaseClient
          .from('user_supplies')
          .update({
            supplied_amount_dec: newSuppliedAmount,
            last_interest_update: new Date().toISOString()
          })
          .eq('id', userSupply.id);

        if (updateError) throw updateError;
      }

      // Update pool reserves
      const newTotalSupply = parseFloat(poolReserve.total_supply_dec) - amount;
      const newAvailableLiquidity = parseFloat(poolReserve.available_liquidity_dec) - amount;
      const newUtilizationRate = newTotalSupply > 0 ? 
        parseFloat(poolReserve.total_borrowed_dec) / newTotalSupply : 0;

      const { error: poolUpdateError } = await supabaseClient
        .from('pool_reserves')
        .update({
          total_supply_dec: newTotalSupply,
          available_liquidity_dec: newAvailableLiquidity,
          utilization_rate: newUtilizationRate,
          last_update_timestamp: new Date().toISOString()
        })
        .eq('id', poolReserve.id);

      if (poolUpdateError) throw poolUpdateError;

      // Update user balance
      await supabaseClient
        .from('balance_snapshots')
        .insert({
          user_id: user.id,
          asset,
          amount: amount, // Positive because user is receiving
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
        chain
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`Error in supply-withdraw function:`, error);
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

    // Calculate total collateral value (simplified - using 1:1 USD for stablecoins)
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