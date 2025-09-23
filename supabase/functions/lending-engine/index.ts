import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Asset price feeds (mock data - in production, fetch from oracles)
const ASSET_PRICES = {
  USDC: 1.0,
  USDT: 1.0,
  DAI: 1.0,
  XAUT: 2650.0, // Gold price per oz
  AURU: 0.85    // Mock governance token price
};

// Liquidation parameters per asset
const LIQUIDATION_PARAMS = {
  USDC: { ltv: 0.85, liquidationThreshold: 0.90, liquidationBonus: 0.05 },
  USDT: { ltv: 0.85, liquidationThreshold: 0.90, liquidationBonus: 0.05 },
  DAI: { ltv: 0.80, liquidationThreshold: 0.85, liquidationBonus: 0.05 },
  XAUT: { ltv: 0.70, liquidationThreshold: 0.75, liquidationBonus: 0.10 },
  AURU: { ltv: 0.65, liquidationThreshold: 0.70, liquidationBonus: 0.15 }
};

interface OperationRequest {
  action: 'supply' | 'withdraw' | 'borrow' | 'repay' | 'calculate_health_factor';
  user_id: string;
  asset?: string;
  chain?: string;
  amount?: number;
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

    const { action, user_id, asset, chain, amount }: OperationRequest = await req.json();

    console.log(`Processing ${action} for user ${user_id}: ${amount} ${asset} on ${chain}`);

    switch (action) {
      case 'supply':
        return await handleSupply(supabaseAdmin, user_id, asset!, chain!, amount!);
      case 'withdraw':
        return await handleWithdraw(supabaseAdmin, user_id, asset!, chain!, amount!);
      case 'borrow':
        return await handleBorrow(supabaseAdmin, user_id, asset!, chain!, amount!);
      case 'repay':
        return await handleRepay(supabaseAdmin, user_id, asset!, chain!, amount!);
      case 'calculate_health_factor':
        return await calculateHealthFactor(supabaseAdmin, user_id, chain || 'ethereum');
      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Error in lending-engine:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleSupply(supabase: any, userId: string, asset: string, chain: string, amount: number) {
  // Get current supply rate
  const { data: poolData } = await supabase
    .from('pool_reserves')
    .select('supply_rate')
    .eq('asset', asset)
    .eq('chain', chain)
    .single();

  const supplyRate = poolData?.supply_rate || 0.05;

  // Check if user already has supply position
  const { data: existingSupply } = await supabase
    .from('user_supplies')
    .select('*')
    .eq('user_id', userId)
    .eq('asset', asset)
    .eq('chain', chain)
    .maybeSingle();

  if (existingSupply) {
    // Update existing position
    const newAmount = parseFloat(existingSupply.supplied_amount_dec) + amount;
    
    await supabase
      .from('user_supplies')
      .update({
        supplied_amount_dec: newAmount,
        supply_rate_at_deposit: supplyRate,
        last_interest_update: new Date().toISOString()
      })
      .eq('id', existingSupply.id);
  } else {
    // Create new position
    await supabase
      .from('user_supplies')
      .insert({
        user_id: userId,
        asset,
        chain,
        supplied_amount_dec: amount,
        supply_rate_at_deposit: supplyRate,
        used_as_collateral: true,
        last_interest_update: new Date().toISOString()
      });
  }

  // Update pool reserves
  await updatePoolReserves(supabase, asset, chain, amount, 'supply');

  return new Response(JSON.stringify({
    success: true,
    message: `Successfully supplied ${amount} ${asset}`,
    supply_rate: supplyRate
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleWithdraw(supabase: any, userId: string, asset: string, chain: string, amount: number) {
  // Get user's supply position
  const { data: supply } = await supabase
    .from('user_supplies')
    .select('*')
    .eq('user_id', userId)
    .eq('asset', asset)
    .eq('chain', chain)
    .single();

  if (!supply || parseFloat(supply.supplied_amount_dec) < amount) {
    throw new Error('Insufficient supplied amount');
  }

  // Check if withdrawal would violate health factor
  const healthFactor = await calculateUserHealthFactor(supabase, userId, chain);
  if (healthFactor < 1.2 && supply.used_as_collateral) {
    throw new Error('Withdrawal would put position at risk. Health factor too low.');
  }

  const newAmount = parseFloat(supply.supplied_amount_dec) - amount;

  if (newAmount <= 0.01) {
    // Remove position if amount is negligible
    await supabase
      .from('user_supplies')
      .delete()
      .eq('id', supply.id);
  } else {
    // Update position
    await supabase
      .from('user_supplies')
      .update({
        supplied_amount_dec: newAmount,
        last_interest_update: new Date().toISOString()
      })
      .eq('id', supply.id);
  }

  // Update pool reserves
  await updatePoolReserves(supabase, asset, chain, -amount, 'supply');

  return new Response(JSON.stringify({
    success: true,
    message: `Successfully withdrew ${amount} ${asset}`,
    new_health_factor: healthFactor
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleBorrow(supabase: any, userId: string, asset: string, chain: string, amount: number) {
  // Check user's health factor before borrowing
  const healthFactor = await calculateUserHealthFactor(supabase, userId, chain);
  if (healthFactor < 1.5) {
    throw new Error('Health factor too low to borrow more assets');
  }

  // Get borrow rate
  const { data: poolData } = await supabase
    .from('pool_reserves')
    .select('borrow_rate_variable, available_liquidity_dec')
    .eq('asset', asset)
    .eq('chain', chain)
    .single();

  if (!poolData || parseFloat(poolData.available_liquidity_dec) < amount) {
    throw new Error('Insufficient liquidity in pool');
  }

  const borrowRate = poolData.borrow_rate_variable || 0.075;

  // Check or create borrow position
  const { data: existingBorrow } = await supabase
    .from('user_borrows')
    .select('*')
    .eq('user_id', userId)
    .eq('asset', asset)
    .eq('chain', chain)
    .maybeSingle();

  if (existingBorrow) {
    const newAmount = parseFloat(existingBorrow.borrowed_amount_dec) + amount;
    
    await supabase
      .from('user_borrows')
      .update({
        borrowed_amount_dec: newAmount,
        borrow_rate_at_time: borrowRate,
        last_interest_update: new Date().toISOString()
      })
      .eq('id', existingBorrow.id);
  } else {
    await supabase
      .from('user_borrows')
      .insert({
        user_id: userId,
        asset,
        chain,
        borrowed_amount_dec: amount,
        borrow_rate_at_time: borrowRate,
        rate_mode: 'variable',
        last_interest_update: new Date().toISOString()
      });
  }

  // Update pool reserves
  await updatePoolReserves(supabase, asset, chain, amount, 'borrow');

  // Recalculate health factor
  const newHealthFactor = await calculateUserHealthFactor(supabase, userId, chain);

  return new Response(JSON.stringify({
    success: true,
    message: `Successfully borrowed ${amount} ${asset}`,
    borrow_rate: borrowRate,
    new_health_factor: newHealthFactor
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleRepay(supabase: any, userId: string, asset: string, chain: string, amount: number) {
  // Get user's borrow position
  const { data: borrow } = await supabase
    .from('user_borrows')
    .select('*')
    .eq('user_id', userId)
    .eq('asset', asset)
    .eq('chain', chain)
    .single();

  if (!borrow || parseFloat(borrow.borrowed_amount_dec) < amount) {
    throw new Error('Repayment amount exceeds borrowed amount');
  }

  const newAmount = parseFloat(borrow.borrowed_amount_dec) - amount;

  if (newAmount <= 0.01) {
    // Remove borrow position
    await supabase
      .from('user_borrows')
      .delete()
      .eq('id', borrow.id);
  } else {
    // Update position
    await supabase
      .from('user_borrows')
      .update({
        borrowed_amount_dec: newAmount,
        last_interest_update: new Date().toISOString()
      })
      .eq('id', borrow.id);
  }

  // Update pool reserves
  await updatePoolReserves(supabase, asset, chain, -amount, 'borrow');

  // Recalculate health factor
  const newHealthFactor = await calculateUserHealthFactor(supabase, userId, chain);

  return new Response(JSON.stringify({
    success: true,
    message: `Successfully repaid ${amount} ${asset}`,
    new_health_factor: newHealthFactor
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function calculateHealthFactor(supabase: any, userId: string, chain: string) {
  const healthFactor = await calculateUserHealthFactor(supabase, userId, chain);
  
  return new Response(JSON.stringify({
    user_id: userId,
    chain,
    health_factor: healthFactor,
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function calculateUserHealthFactor(supabase: any, userId: string, chain: string): Promise<number> {
  // Get user supplies
  const { data: supplies } = await supabase
    .from('user_supplies')
    .select('*')
    .eq('user_id', userId)
    .eq('chain', chain);

  // Get user borrows
  const { data: borrows } = await supabase
    .from('user_borrows')
    .select('*')
    .eq('user_id', userId)
    .eq('chain', chain);

  let totalCollateralUsd = 0;
  let totalDebtUsd = 0;
  let weightedLiquidationThreshold = 0;

  // Calculate collateral value
  if (supplies) {
    for (const supply of supplies) {
      if (supply.used_as_collateral) {
        const assetPrice = ASSET_PRICES[supply.asset as keyof typeof ASSET_PRICES] || 1;
        const params = LIQUIDATION_PARAMS[supply.asset as keyof typeof LIQUIDATION_PARAMS];
        const collateralValue = parseFloat(supply.supplied_amount_dec) * assetPrice;
        
        totalCollateralUsd += collateralValue;
        weightedLiquidationThreshold += collateralValue * params.liquidationThreshold;
      }
    }
  }

  // Calculate debt value
  if (borrows) {
    for (const borrow of borrows) {
      const assetPrice = ASSET_PRICES[borrow.asset as keyof typeof ASSET_PRICES] || 1;
      totalDebtUsd += parseFloat(borrow.borrowed_amount_dec) * assetPrice;
    }
  }

  if (totalCollateralUsd > 0) {
    weightedLiquidationThreshold = weightedLiquidationThreshold / totalCollateralUsd;
  }

  // Health Factor = (Collateral * Liquidation Threshold) / Total Debt
  if (totalDebtUsd === 0) {
    return 999; // No debt = very healthy
  }

  return (totalCollateralUsd * weightedLiquidationThreshold) / totalDebtUsd;
}

async function updatePoolReserves(supabase: any, asset: string, chain: string, amount: number, type: 'supply' | 'borrow') {
  const { data: poolData } = await supabase
    .from('pool_reserves')
    .select('total_supply_dec, total_borrowed_dec, available_liquidity_dec')
    .eq('asset', asset)
    .eq('chain', chain)
    .single();

  if (poolData) {
    let updates: any = {
      last_update_timestamp: new Date().toISOString()
    };

    if (type === 'supply') {
      updates.total_supply_dec = parseFloat(poolData.total_supply_dec) + amount;
      updates.available_liquidity_dec = parseFloat(poolData.available_liquidity_dec) + amount;
    } else {
      updates.total_borrowed_dec = parseFloat(poolData.total_borrowed_dec) + amount;
      updates.available_liquidity_dec = parseFloat(poolData.available_liquidity_dec) - amount;
    }

    // Calculate new utilization rate
    if (updates.total_supply_dec > 0) {
      updates.utilization_rate = updates.total_borrowed_dec / updates.total_supply_dec;
    }

    await supabase
      .from('pool_reserves')
      .update(updates)
      .eq('asset', asset)
      .eq('chain', chain);
  }
}