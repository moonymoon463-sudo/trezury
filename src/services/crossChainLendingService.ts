import { supabase } from "@/integrations/supabase/client";
import { Chain, Token } from "@/types/lending";
import { chainValidationService } from "./chainValidationService";

export interface CrossChainPosition {
  chain: Chain;
  asset: Token;
  supplied_amount: number;
  borrowed_amount: number;
  health_factor: number;
  apy_earned: number;
  apy_owed: number;
}

export interface CrossChainSummary {
  total_supplied_usd: number;
  total_borrowed_usd: number;
  weighted_health_factor: number;
  net_apy: number;
  positions_by_chain: Record<Chain, CrossChainPosition[]>;
}

export interface ChainBridgeQuote {
  from_chain: Chain;
  to_chain: Chain;
  asset: Token;
  amount: number;
  estimated_time: string;
  bridge_fee: number;
  gas_estimate: number;
  total_cost: number;
}

export class CrossChainLendingService {

  static async getCrossChainSummary(userId: string): Promise<CrossChainSummary> {
    try {
      // Get all user positions across all chains
      const [suppliesResponse, borrowsResponse, healthFactorsResponse] = await Promise.all([
        supabase
          .from('user_supplies')
          .select('*')
          .eq('user_id', userId),
        supabase
          .from('user_borrows')
          .select('*')
          .eq('user_id', userId),
        supabase
          .from('user_health_factors')
          .select('*')
          .eq('user_id', userId)
      ]);

      if (suppliesResponse.error) throw suppliesResponse.error;
      if (borrowsResponse.error) throw borrowsResponse.error;
      if (healthFactorsResponse.error) throw healthFactorsResponse.error;

      const supplies = suppliesResponse.data || [];
      const borrows = borrowsResponse.data || [];
      const healthFactors = healthFactorsResponse.data || [];

      // Group positions by chain
      const positionsByChain: Record<Chain, CrossChainPosition[]> = {} as Record<Chain, CrossChainPosition[]>;
      const supportedChains = chainValidationService.getSupportedChains();

      for (const chain of supportedChains) {
        const chainSupplies = supplies.filter(s => s.chain === chain);
        const chainBorrows = borrows.filter(b => b.chain === chain);
        const chainHealthFactor = healthFactors.find(h => h.chain === chain);

        const positions: CrossChainPosition[] = [];

        // Combine supply and borrow positions by asset
        const assetMap = new Map<Token, Partial<CrossChainPosition>>();

        // Add supplies
        for (const supply of chainSupplies) {
          if (!assetMap.has(supply.asset as Token)) {
            assetMap.set(supply.asset as Token, {
              chain,
              asset: supply.asset as Token,
              supplied_amount: 0,
              borrowed_amount: 0,
              health_factor: chainHealthFactor?.health_factor || 0,
              apy_earned: 0,
              apy_owed: 0
            });
          }
          const position = assetMap.get(supply.asset as Token)!;
          position.supplied_amount! += supply.supplied_amount_dec;
          position.apy_earned = supply.supply_rate_at_deposit;
        }

        // Add borrows
        for (const borrow of chainBorrows) {
          if (!assetMap.has(borrow.asset as Token)) {
            assetMap.set(borrow.asset as Token, {
              chain,
              asset: borrow.asset as Token,
              supplied_amount: 0,
              borrowed_amount: 0,
              health_factor: chainHealthFactor?.health_factor || 0,
              apy_earned: 0,
              apy_owed: 0
            });
          }
          const position = assetMap.get(borrow.asset as Token)!;
          position.borrowed_amount! += borrow.borrowed_amount_dec;
          position.apy_owed = borrow.borrow_rate_at_creation;
        }

        positions.push(...Array.from(assetMap.values()) as CrossChainPosition[]);
        if (positions.length > 0) {
          positionsByChain[chain] = positions;
        }
      }

      // Calculate totals
      let totalSuppliedUsd = 0;
      let totalBorrowedUsd = 0;
      let weightedHealthFactorSum = 0;
      let totalPositionValue = 0;

      for (const positions of Object.values(positionsByChain)) {
        for (const position of positions) {
          // Assume 1:1 USD for simplicity (in production, use actual price feeds)
          const suppliedUsd = position.supplied_amount * 1;
          const borrowedUsd = position.borrowed_amount * 1;
          
          totalSuppliedUsd += suppliedUsd;
          totalBorrowedUsd += borrowedUsd;
          
          const positionValue = suppliedUsd + borrowedUsd;
          weightedHealthFactorSum += position.health_factor * positionValue;
          totalPositionValue += positionValue;
        }
      }

      const weightedHealthFactor = totalPositionValue > 0 ? weightedHealthFactorSum / totalPositionValue : 0;
      const netApy = totalSuppliedUsd > 0 ? 
        ((totalSuppliedUsd * 0.05) - (totalBorrowedUsd * 0.07)) / totalSuppliedUsd * 100 : 0;

      return {
        total_supplied_usd: totalSuppliedUsd,
        total_borrowed_usd: totalBorrowedUsd,
        weighted_health_factor: weightedHealthFactor,
        net_apy: netApy,
        positions_by_chain: positionsByChain
      };

    } catch (error) {
      console.error('Error fetching cross-chain summary:', error);
      throw error;
    }
  }

  static async getBridgeQuote(
    fromChain: Chain,
    toChain: Chain,
    asset: Token,
    amount: number
  ): Promise<ChainBridgeQuote> {
    try {
      // Validate chains and asset
      chainValidationService.validateFeeCollectionRequest(fromChain, asset, amount);
      chainValidationService.validateFeeCollectionRequest(toChain, asset, amount);

      // Mock bridge quote calculation (in production, integrate with actual bridge APIs)
      const baseFee = amount * 0.001; // 0.1% bridge fee
      const gasEstimate = fromChain === 'ethereum' ? 50 : 5; // USD gas estimate
      const totalCost = baseFee + gasEstimate;

      let estimatedTime = "5-15 minutes";
      if (fromChain === 'ethereum' || toChain === 'ethereum') {
        estimatedTime = "10-30 minutes";
      }
      if (fromChain === 'solana' || toChain === 'solana') {
        estimatedTime = "2-5 minutes";
      }

      return {
        from_chain: fromChain,
        to_chain: toChain,
        asset,
        amount,
        estimated_time: estimatedTime,
        bridge_fee: baseFee,
        gas_estimate: gasEstimate,
        total_cost: totalCost
      };

    } catch (error) {
      console.error('Error getting bridge quote:', error);
      throw error;
    }
  }

  static async getChainSpecificRates(chain: Chain): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('pool_reserves')
        .select('*')
        .eq('chain', chain)
        .eq('is_active', true);

      if (error) throw error;

      return data?.map(reserve => ({
        asset: reserve.asset,
        chain: reserve.chain,
        supply_rate: reserve.supply_rate,
        borrow_rate_variable: reserve.borrow_rate_variable,
        borrow_rate_stable: reserve.borrow_rate_stable,
        utilization_rate: reserve.utilization_rate,
        total_liquidity: reserve.available_liquidity_dec,
        ltv: reserve.ltv,
        liquidation_threshold: reserve.liquidation_threshold
      })) || [];

    } catch (error) {
      console.error('Error fetching chain-specific rates:', error);
      throw error;
    }
  }

  static async getOptimalChainForOperation(
    operation: 'supply' | 'borrow',
    asset: Token,
    amount: number
  ): Promise<{ chain: Chain; reason: string; apy: number; }[]> {
    try {
      const supportedChains = chainValidationService.getSupportedChains();
      const recommendations = [];

      for (const chain of supportedChains) {
        try {
          const rates = await this.getChainSpecificRates(chain);
          const assetRate = rates.find(r => r.asset === asset);
          
          if (assetRate) {
            const apy = operation === 'supply' ? assetRate.supply_rate : assetRate.borrow_rate_variable;
            let reason = `${(apy * 100).toFixed(2)}% APY`;
            
            // Add additional factors
            if (chain === 'base') {
              reason += " • Low fees";
            } else if (chain === 'ethereum') {
              reason += " • High liquidity";
            } else if (chain === 'solana') {
              reason += " • Fast transactions";
            }

            if (assetRate.utilization_rate < 0.5) {
              reason += " • Good availability";
            }

            recommendations.push({
              chain,
              reason,
              apy: apy * 100
            });
          }
        } catch (error) {
          console.error(`Error getting rates for ${chain}:`, error);
        }
      }

      // Sort by APY (highest for supply, lowest for borrow)
      return recommendations.sort((a, b) => 
        operation === 'supply' ? b.apy - a.apy : a.apy - b.apy
      );

    } catch (error) {
      console.error('Error getting optimal chain recommendations:', error);
      throw error;
    }
  }

  static async executeCrossChainTransfer(
    fromChain: Chain,
    toChain: Chain,
    asset: Token,
    amount: number,
    userId: string
  ): Promise<{ success: boolean; transaction_id?: string; error?: string }> {
    try {
      // Validate the transfer
      chainValidationService.validateFeeCollectionRequest(fromChain, asset, amount);
      chainValidationService.validateFeeCollectionRequest(toChain, asset, amount);

      // Check user has sufficient balance on source chain
      const { data: userSupplies, error: suppliesError } = await supabase
        .from('user_supplies')
        .select('*')
        .eq('user_id', userId)
        .eq('chain', fromChain)
        .eq('asset', asset);

      if (suppliesError) throw suppliesError;

      const totalSupplied = userSupplies?.reduce((sum, supply) => sum + supply.supplied_amount_dec, 0) || 0;
      
      if (totalSupplied < amount) {
        return {
          success: false,
          error: `Insufficient balance. Available: ${totalSupplied}, Requested: ${amount}`
        };
      }

      // Get bridge quote for fee calculation
      const bridgeQuote = await this.getBridgeQuote(fromChain, toChain, asset, amount);
      const netAmount = amount - bridgeQuote.bridge_fee;

      // Create transfer record
      const transferId = crypto.randomUUID();
      
      // In production, this would interact with actual bridge contracts
      // For now, we'll simulate the transfer by updating balances

      // Reduce balance on source chain
      const { error: reduceError } = await supabase
        .from('user_supplies')
        .update({
          supplied_amount_dec: Math.max(0, totalSupplied - amount),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('chain', fromChain)
        .eq('asset', asset);

      if (reduceError) throw reduceError;

      // Add balance on destination chain
      const { error: addError } = await supabase
        .from('user_supplies')
        .upsert({
          user_id: userId,
          chain: toChain,
          asset,
          supplied_amount_dec: netAmount,
          supply_rate_at_deposit: 0.05, // Default rate
          last_interest_update: new Date().toISOString(),
          used_as_collateral: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (addError) throw addError;

      return {
        success: true,
        transaction_id: transferId
      };

    } catch (error) {
      console.error('Error executing cross-chain transfer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static formatChainName(chain: Chain): string {
    return chainValidationService.getChainDisplayName(chain);
  }

  static formatAPY(apy: number): string {
    return `${(apy * 100).toFixed(2)}%`;
  }

  static formatAmount(amount: number, asset: Token): string {
    return `${amount.toLocaleString()} ${asset}`;
  }

  static formatUSD(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}