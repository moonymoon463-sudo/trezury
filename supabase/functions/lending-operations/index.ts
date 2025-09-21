import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OperationRequest {
  action: 'supply' | 'withdraw' | 'borrow' | 'repay';
  asset: string;
  chain: string;
  amount: number;
  user_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, asset, chain, amount, user_id }: OperationRequest = await req.json();

    console.log(`Processing ${action} operation:`, { asset, chain, amount, user_id });

    let result;

    switch (action) {
      case 'supply':
        result = await handleSupply(supabase, user_id, asset, chain, amount);
        break;
      case 'withdraw':
        result = await handleWithdraw(supabase, user_id, asset, chain, amount);
        break;
      case 'borrow':
        result = await handleBorrow(supabase, user_id, asset, chain, amount);
        break;
      case 'repay':
        result = await handleRepay(supabase, user_id, asset, chain, amount);
        break;
      default:
        throw new Error(`Invalid action: ${action}`);
    }

    // Update health factor after any operation
    await updateHealthFactor(supabase, user_id, chain);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Lending operation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

async function handleSupply(supabase: any, userId: string, asset: string, chain: string, amount: number) {
  // Check if user already has a supply position
  const { data: existingSupply } = await supabase
    .from('user_supplies')
    .select('*')
    .eq('user_id', userId)
    .eq('asset', asset)
    .eq('chain', chain)
    .single();

  if (existingSupply) {
    // Update existing position
    const { data, error } = await supabase
      .from('user_supplies')
      .update({
        supplied_amount_dec: existingSupply.supplied_amount_dec + amount,
        last_interest_update: new Date().toISOString()
      })
      .eq('id', existingSupply.id)
      .select();

    if (error) throw error;
    return data[0];
  } else {
    // Create new position
    const { data, error } = await supabase
      .from('user_supplies')
      .insert({
        user_id: userId,
        asset,
        chain,
        supplied_amount_dec: amount,
        accrued_interest_dec: 0,
        last_interest_update: new Date().toISOString()
      })
      .select();

    if (error) throw error;
    return data[0];
  }
}

async function handleWithdraw(supabase: any, userId: string, asset: string, chain: string, amount: number) {
  const { data: supply, error: fetchError } = await supabase
    .from('user_supplies')
    .select('*')
    .eq('user_id', userId)
    .eq('asset', asset)
    .eq('chain', chain)
    .single();

  if (fetchError || !supply) {
    throw new Error('No supply position found');
  }

  if (supply.supplied_amount_dec < amount) {
    throw new Error('Insufficient supplied amount');
  }

  const newAmount = supply.supplied_amount_dec - amount;

  if (newAmount === 0) {
    // Remove position if fully withdrawn
    const { error } = await supabase
      .from('user_supplies')
      .delete()
      .eq('id', supply.id);

    if (error) throw error;
    return { withdrawn: amount, remaining: 0 };
  } else {
    // Update position
    const { data, error } = await supabase
      .from('user_supplies')
      .update({
        supplied_amount_dec: newAmount,
        last_interest_update: new Date().toISOString()
      })
      .eq('id', supply.id)
      .select();

    if (error) throw error;
    return data[0];
  }
}

async function handleBorrow(supabase: any, userId: string, asset: string, chain: string, amount: number) {
  // Get current health factor to check if borrow is allowed
  const { data: healthData } = await supabase
    .from('user_health_factors')
    .select('health_factor')
    .eq('user_id', userId)
    .eq('chain', chain)
    .single();

  if (healthData && healthData.health_factor < 1.5) {
    throw new Error('Health factor too low for borrowing');
  }

  // Check if user already has a borrow position
  const { data: existingBorrow } = await supabase
    .from('user_borrows')
    .select('*')
    .eq('user_id', userId)
    .eq('asset', asset)
    .eq('chain', chain)
    .single();

  if (existingBorrow) {
    // Update existing position
    const { data, error } = await supabase
      .from('user_borrows')
      .update({
        borrowed_amount_dec: existingBorrow.borrowed_amount_dec + amount,
        last_interest_update: new Date().toISOString()
      })
      .eq('id', existingBorrow.id)
      .select();

    if (error) throw error;
    return data[0];
  } else {
    // Create new position
    const { data, error } = await supabase
      .from('user_borrows')
      .insert({
        user_id: userId,
        asset,
        chain,
        borrowed_amount_dec: amount,
        accrued_interest_dec: 0,
        rate_mode: 'variable',
        borrow_rate_at_creation: 0.05, // Default 5%
        last_interest_update: new Date().toISOString()
      })
      .select();

    if (error) throw error;
    return data[0];
  }
}

async function handleRepay(supabase: any, userId: string, asset: string, chain: string, amount: number) {
  const { data: borrow, error: fetchError } = await supabase
    .from('user_borrows')
    .select('*')
    .eq('user_id', userId)
    .eq('asset', asset)
    .eq('chain', chain)
    .single();

  if (fetchError || !borrow) {
    throw new Error('No borrow position found');
  }

  if (borrow.borrowed_amount_dec < amount) {
    throw new Error('Repay amount exceeds borrowed amount');
  }

  const newAmount = borrow.borrowed_amount_dec - amount;

  if (newAmount === 0) {
    // Remove position if fully repaid
    const { error } = await supabase
      .from('user_borrows')
      .delete()
      .eq('id', borrow.id);

    if (error) throw error;
    return { repaid: amount, remaining: 0 };
  } else {
    // Update position
    const { data, error } = await supabase
      .from('user_borrows')
      .update({
        borrowed_amount_dec: newAmount,
        last_interest_update: new Date().toISOString()
      })
      .eq('id', borrow.id)
      .select();

    if (error) throw error;
    return data[0];
  }
}

async function updateHealthFactor(supabase: any, userId: string, chain: string) {
  // Get user supplies and borrows
  const [suppliesRes, borrowsRes] = await Promise.all([
    supabase.from('user_supplies').select('*').eq('user_id', userId).eq('chain', chain),
    supabase.from('user_borrows').select('*').eq('user_id', userId).eq('chain', chain)
  ]);

  const supplies = suppliesRes.data || [];
  const borrows = borrowsRes.data || [];

  // Simple calculation - in production this would be more complex
  const totalCollateralUsd = supplies.reduce((sum: number, supply: any) => sum + supply.supplied_amount_dec, 0);
  const totalDebtUsd = borrows.reduce((sum: number, borrow: any) => sum + borrow.borrowed_amount_dec, 0);
  
  const healthFactor = totalDebtUsd > 0 ? (totalCollateralUsd * 0.8) / totalDebtUsd : 999;
  const ltv = totalCollateralUsd > 0 ? totalDebtUsd / totalCollateralUsd : 0;

  // Upsert health factor
  await supabase
    .from('user_health_factors')
    .upsert({
      user_id: userId,
      chain,
      health_factor: healthFactor,
      total_collateral_usd: totalCollateralUsd,
      total_debt_usd: totalDebtUsd,
      ltv,
      liquidation_threshold: 0.8,
      available_borrow_usd: Math.max(0, (totalCollateralUsd * 0.8) - totalDebtUsd),
      last_calculated_at: new Date().toISOString()
    });

  return healthFactor;
}