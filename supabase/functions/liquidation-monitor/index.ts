import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface LiquidationTarget {
  user_id: string;
  health_factor: number;
  total_debt_usd: number;
  total_collateral_usd: number;
  chain: string;
}

interface LiquidationExecution {
  liquidator_id: string;
  target_user_id: string;
  collateral_asset: string;
  debt_asset: string;
  debt_to_cover: number;
  chain: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    console.log(`Liquidation monitor action: ${action}`, params);

    switch (action) {
      case 'scan_liquidation_targets':
        return await scanLiquidationTargets();
      
      case 'execute_liquidation':
        return await executeLiquidation(params as LiquidationExecution);
      
      case 'check_user_health':
        return await checkUserHealth(params.user_id, params.chain);
      
      case 'get_liquidation_history':
        return await getLiquidationHistory(params.user_id);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in liquidation-monitor function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function scanLiquidationTargets() {
  console.log('Scanning for liquidation targets...');
  
  // Find users with health factors below 1.0
  const { data: targets, error } = await supabase
    .from('user_health_factors')
    .select('*')
    .lt('health_factor', 1.0)
    .gt('total_debt_usd', 0)
    .order('health_factor', { ascending: true });

  if (error) {
    console.error('Error scanning liquidation targets:', error);
    throw error;
  }

  console.log(`Found ${targets?.length || 0} liquidation targets`);

  const liquidationOpportunities = [];
  
  for (const target of targets || []) {
    // Get liquidation parameters for this target
    const { data: eligibility } = await supabase
      .rpc('check_liquidation_eligibility', {
        target_user_id: target.user_id,
        target_chain: target.chain
      });

    if (eligibility && eligibility[0]?.liquidatable) {
      liquidationOpportunities.push({
        user_id: target.user_id,
        health_factor: target.health_factor,
        total_debt_usd: target.total_debt_usd,
        total_collateral_usd: target.total_collateral_usd,
        chain: target.chain,
        liquidation_bonus: eligibility[0].liquidation_bonus,
        max_liquidation_amount: eligibility[0].max_liquidation_amount,
        potential_profit: eligibility[0].max_liquidation_amount * eligibility[0].liquidation_bonus
      });
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      targets: liquidationOpportunities,
      scan_timestamp: new Date().toISOString()
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function executeLiquidation(params: LiquidationExecution) {
  console.log('Executing liquidation:', params);
  
  const { liquidator_id, target_user_id, collateral_asset, debt_asset, debt_to_cover, chain } = params;

  // Verify liquidation eligibility
  const { data: eligibility } = await supabase
    .rpc('check_liquidation_eligibility', {
      target_user_id,
      target_chain: chain
    });

  if (!eligibility || !eligibility[0]?.liquidatable) {
    throw new Error('User is not eligible for liquidation');
  }

  const liquidationData = eligibility[0];

  // Calculate liquidation amounts
  const maxDebtToCover = Math.min(debt_to_cover, liquidationData.max_liquidation_amount);
  const collateralReceived = maxDebtToCover * (1 + liquidationData.liquidation_bonus);

  // Get user's current positions
  const { data: userSupplies } = await supabase
    .from('user_supplies')
    .select('*')
    .eq('user_id', target_user_id)
    .eq('asset', collateral_asset)
    .eq('chain', chain)
    .single();

  const { data: userBorrows } = await supabase
    .from('user_borrows')
    .select('*')
    .eq('user_id', target_user_id)
    .eq('asset', debt_asset)
    .eq('chain', chain)
    .single();

  if (!userSupplies || !userBorrows) {
    throw new Error('User positions not found');
  }

  if (userSupplies.supplied_amount_dec < collateralReceived) {
    throw new Error('Insufficient collateral to liquidate');
  }

  if (userBorrows.borrowed_amount_dec < maxDebtToCover) {
    throw new Error('Debt amount exceeds user borrowed amount');
  }

  // Start transaction for liquidation
  const { data: liquidationCall, error: liquidationError } = await supabase
    .from('liquidation_calls')
    .insert({
      user_id: target_user_id,
      liquidator_id,
      collateral_asset,
      debt_asset,
      debt_to_cover_dec: maxDebtToCover,
      liquidated_collateral_dec: collateralReceived,
      liquidation_bonus_dec: maxDebtToCover * liquidationData.liquidation_bonus,
      health_factor_before: liquidationData.health_factor,
      chain,
      status: 'pending'
    })
    .select()
    .single();

  if (liquidationError) {
    console.error('Error creating liquidation call:', liquidationError);
    throw liquidationError;
  }

  try {
    // Update user's supply position (reduce collateral)
    const { error: supplyError } = await supabase
      .from('user_supplies')
      .update({
        supplied_amount_dec: userSupplies.supplied_amount_dec - collateralReceived,
        updated_at: new Date().toISOString()
      })
      .eq('id', userSupplies.id);

    if (supplyError) throw supplyError;

    // Update user's borrow position (reduce debt)
    const { error: borrowError } = await supabase
      .from('user_borrows')
      .update({
        borrowed_amount_dec: userBorrows.borrowed_amount_dec - maxDebtToCover,
        updated_at: new Date().toISOString()
      })
      .eq('id', userBorrows.id);

    if (borrowError) throw borrowError;

    // Update liquidation call status
    const { error: updateError } = await supabase
      .from('liquidation_calls')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        tx_hash: `liquidation_${liquidationCall.id}_${Date.now()}` // Placeholder for actual tx hash
      })
      .eq('id', liquidationCall.id);

    if (updateError) throw updateError;

    // Recalculate user's health factor
    await supabase.functions.invoke('supply-withdraw', {
      body: {
        action: 'recalculate_health',
        user_id: target_user_id,
        chain
      }
    });

    console.log('Liquidation executed successfully:', liquidationCall.id);

    return new Response(
      JSON.stringify({
        success: true,
        liquidation_id: liquidationCall.id,
        debt_covered: maxDebtToCover,
        collateral_received: collateralReceived,
        liquidation_bonus: maxDebtToCover * liquidationData.liquidation_bonus,
        execution_timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    // Mark liquidation as failed
    await supabase
      .from('liquidation_calls')
      .update({ status: 'failed' })
      .eq('id', liquidationCall.id);
    
    throw error;
  }
}

async function checkUserHealth(user_id: string, chain: string = 'ethereum') {
  console.log('Checking user health:', user_id, chain);
  
  const { data: healthFactor } = await supabase
    .from('user_health_factors')
    .select('*')
    .eq('user_id', user_id)
    .eq('chain', chain)
    .single();

  if (!healthFactor) {
    return new Response(
      JSON.stringify({
        success: true,
        health_factor: null,
        liquidatable: false,
        message: 'No health factor found for user'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const { data: eligibility } = await supabase
    .rpc('check_liquidation_eligibility', {
      target_user_id: user_id,
      target_chain: chain
    });

  return new Response(
    JSON.stringify({
      success: true,
      health_factor: healthFactor.health_factor,
      total_debt_usd: healthFactor.total_debt_usd,
      total_collateral_usd: healthFactor.total_collateral_usd,
      liquidatable: eligibility?.[0]?.liquidatable || false,
      liquidation_details: eligibility?.[0] || null,
      last_updated: healthFactor.last_calculated_at
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function getLiquidationHistory(user_id?: string) {
  console.log('Getting liquidation history for user:', user_id);
  
  let query = supabase
    .from('liquidation_calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (user_id) {
    query = query.or(`user_id.eq.${user_id},liquidator_id.eq.${user_id}`);
  }

  const { data: liquidations, error } = await query;

  if (error) {
    console.error('Error fetching liquidation history:', error);
    throw error;
  }

  return new Response(
    JSON.stringify({
      success: true,
      liquidations: liquidations || [],
      total_count: liquidations?.length || 0
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}