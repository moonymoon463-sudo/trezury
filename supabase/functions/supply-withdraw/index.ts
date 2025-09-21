import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ethers } from "https://esm.sh/ethers@6.8.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SupplyWithdrawRequest {
  action: 'supply' | 'withdraw';
  asset: string;
  amount: number;
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

    const { action, asset, amount, chain = 'ethereum', walletAddress }: SupplyWithdrawRequest = await req.json();

    console.log(`Processing ${action} request:`, { userId: user.id, asset, amount, chain, walletAddress });

    // Get demo wallet private key for blockchain transactions
    const demoPrivateKey = Deno.env.get('DEMO_WALLET_PRIVATE_KEY');
    if (!demoPrivateKey) {
      console.warn('⚠️ No DEMO_WALLET_PRIVATE_KEY found, using database-only mode');
    }

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

    let txHash: string | null = null;
    let blockchainSuccess = false;

    if (action === 'supply') {
      console.log('📤 Processing supply operation with blockchain support...');

      // Try to perform blockchain transaction if demo wallet is available
      if (demoPrivateKey && walletAddress) {
        try {
          console.log('🔗 Attempting blockchain supply transaction...');
          txHash = await performSupplyTransaction(asset, amount, walletAddress, demoPrivateKey, chain);
          blockchainSuccess = true;
          console.log('✅ Blockchain transaction successful:', txHash);
        } catch (blockchainError) {
          console.error('❌ Blockchain transaction failed:', blockchainError);
          // Continue with database update even if blockchain fails
        }
      } else {
        console.log('ℹ️ Demo wallet not configured, using database-only mode');
      }

      // Database update regardless of blockchain success
      const { data: existingSupply } = await supabaseClient
        .from('user_supplies')
        .select('*')
        .eq('user_id', user.id)
        .eq('asset', asset)
        .eq('chain', chain)
        .single();

      if (existingSupply) {
        // Update existing supply
        const { error: updateError } = await supabaseClient
          .from('user_supplies')
          .update({
            supplied_amount_dec: parseFloat(existingSupply.supplied_amount_dec) + amount,
            last_interest_update: new Date().toISOString()
          })
          .eq('id', existingSupply.id);

        if (updateError) throw updateError;
      } else {
        // Create new supply
        const { error: insertError } = await supabaseClient
          .from('user_supplies')
          .insert({
            user_id: user.id,
            asset,
            chain,
            supplied_amount_dec: amount,
            accrued_interest_dec: 0,
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

      // Update user balance snapshot
      await supabaseClient
        .from('balance_snapshots')
        .insert({
          user_id: user.id,
          asset,
          amount: -amount, // Negative because user is supplying
          snapshot_at: new Date().toISOString()
        });

    } else if (action === 'withdraw') {
      console.log('📥 Processing withdraw operation...');

      // Get user's supply position
      const { data: userSupply, error: supplyError } = await supabaseClient
        .from('user_supplies')
        .select('*')
        .eq('user_id', user.id)
        .eq('asset', asset)
        .eq('chain', chain)
        .single();

      if (supplyError || !userSupply) {
        throw new Error(`No supply position found for ${asset}`);
      }

      const suppliedAmount = parseFloat(userSupply.supplied_amount_dec);
      const withdrawAmount = Math.min(amount, suppliedAmount); // Don't withdraw more than supplied

      if (withdrawAmount <= 0) {
        throw new Error('Invalid withdraw amount');
      }

      // Update user supply position
      const newSuppliedAmount = suppliedAmount - withdrawAmount;
      if (newSuppliedAmount <= 0.01) { // Close position if very small amount left
        await supabaseClient
          .from('user_supplies')
          .delete()
          .eq('id', userSupply.id);
      } else {
        await supabaseClient
          .from('user_supplies')
          .update({
            supplied_amount_dec: newSuppliedAmount,
            last_interest_update: new Date().toISOString()
          })
          .eq('id', userSupply.id);
      }

      // Update pool reserves
      await supabaseClient
        .from('pool_reserves')
        .update({
          total_supply_dec: parseFloat(poolReserve.total_supply_dec) - withdrawAmount,
          available_liquidity_dec: parseFloat(poolReserve.available_liquidity_dec) - withdrawAmount,
          utilization_rate: (parseFloat(poolReserve.total_borrowed_dec)) / (parseFloat(poolReserve.total_supply_dec) - withdrawAmount),
          last_update_timestamp: new Date().toISOString()
        })
        .eq('id', poolReserve.id);

      // Update user balance snapshot
      await supabaseClient
        .from('balance_snapshots')
        .insert({
          user_id: user.id,
          asset,
          amount: withdrawAmount, // Positive because user is receiving
          snapshot_at: new Date().toISOString()
        });
    }

    // Recalculate and update user health factor
    await updateUserHealthFactor(supabaseClient, user.id, chain);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${action} operation completed successfully${blockchainSuccess ? ' with blockchain transaction' : ' (database only)'}`,
        amount,
        asset,
        chain,
        txHash: txHash || null,
        blockchainSuccess: blockchainSuccess || false,
        mode: blockchainSuccess ? 'blockchain' : 'database'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in supply-withdraw function:', error);
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
 * Update user health factor after supply/withdraw operations
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

/**
 * Perform actual blockchain supply transaction
 */
async function performSupplyTransaction(
  asset: string, 
  amount: number, 
  walletAddress: string, 
  privateKey: string,
  chain: string
): Promise<string> {
  console.log(`🔗 Performing blockchain supply: ${amount} ${asset} on ${chain}`);

  // Get RPC URL from blockchain operations service
  const rpcResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/blockchain-operations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    },
    body: JSON.stringify({ operation: 'get_rpc_url', chain })
  });

  const rpcData = await rpcResponse.json();
  if (!rpcData.success) {
    throw new Error(`Failed to get RPC URL: ${rpcData.error}`);
  }

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(rpcData.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  // Token contracts on Sepolia testnet
  const tokenContracts: Record<string, string> = {
    'USDC': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC on Sepolia
    'USDT': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // Example USDT
    'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'   // Example DAI
  };

  const tokenAddress = tokenContracts[asset];
  if (!tokenAddress) {
    throw new Error(`Token ${asset} not supported on ${chain}`);
  }

  // ERC20 ABI for basic token operations
  const erc20Abi = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];

  const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
  
  // For demo: transfer tokens to a "lending pool" address (platform wallet)
  const lendingPoolAddress = "0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835"; // Platform wallet
  
  // Get token decimals and convert amount
  const decimals = await tokenContract.decimals();
  const amountWei = ethers.parseUnits(amount.toString(), decimals);
  
  // Perform the transfer (simulating supply to lending pool)
  console.log(`🔄 Transferring ${amount} ${asset} to lending pool...`);
  const tx = await tokenContract.transfer(lendingPoolAddress, amountWei);
  
  console.log(`📤 Transaction submitted: ${tx.hash}`);
  
  // Wait for confirmation
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
  
  return tx.hash;
}