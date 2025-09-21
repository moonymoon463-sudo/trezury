import { supabase } from "@/integrations/supabase/client";

interface APYCalculationParams {
  chain: string;
  token: string;
  termDays?: number;
  amount?: number;
}

interface APYResult {
  baseAPY: number;
  platformFeeAPY: number;
  netAPY: number;
  utilizationMultiplier: number;
  demandMultiplier: number;
  governanceBonus: number;
  totalEarningsProjection: number;
}

export class SustainableAPYService {
  private static readonly PLATFORM_BASE_FEE = 0.018; // 1.8% base platform fee
  private static readonly MAX_PLATFORM_FEE = 0.025; // 2.5% max platform fee during high utilization
  private static readonly MIN_PLATFORM_FEE = 0.01; // 1% min platform fee
  private static readonly GOVERNANCE_BONUS_RATE = 0.002; // 0.2% bonus for AURU holders

  /**
   * Calculate sustainable APY with dynamic fee structure
   */
  static async calculateSustainableAPY(params: APYCalculationParams): Promise<APYResult> {
    try {
      // Get current pool utilization and market conditions
      const { data: poolStats } = await supabase
        .from('pool_stats')
        .select('*')
        .eq('chain', params.chain)
        .eq('token', params.token)
        .single();

      // Get pool reserves for additional data
      const { data: poolReserve } = await supabase
        .from('pool_reserves')
        .select('*')
        .eq('chain', params.chain)
        .eq('asset', params.token)
        .single();

      if (!poolStats || !poolReserve) {
        throw new Error('Pool data not found');
      }

      // Calculate base APY from utilization
      const utilization = poolStats.utilization_fp;
      const baseAPY = this.calculateBaseAPY(utilization, params.token);

      // Calculate dynamic platform fee based on utilization and demand
      const platformFeeRate = this.calculateDynamicPlatformFee(utilization, baseAPY);
      
      // Calculate utilization multiplier (higher utilization = higher APY)
      const utilizationMultiplier = this.calculateUtilizationMultiplier(utilization);
      
      // Calculate demand multiplier based on recent deposit trends
      const demandMultiplier = await this.calculateDemandMultiplier(params.chain, params.token);
      
      // Calculate governance bonus for AURU holders
      const governanceBonus = await this.calculateGovernanceBonus();
      
      // Apply all multipliers to base APY
      const grossAPY = baseAPY * (1 + utilizationMultiplier + demandMultiplier + governanceBonus);
      
      // Calculate net APY after platform fees
      const platformFeeAPY = grossAPY * platformFeeRate;
      const netAPY = grossAPY - platformFeeAPY;

      // Calculate total earnings projection if amount provided
      const totalEarningsProjection = params.amount 
        ? this.calculateEarningsProjection(params.amount, netAPY, params.termDays || 365)
        : 0;

      return {
        baseAPY: baseAPY * 100, // Convert to percentage
        platformFeeAPY: platformFeeAPY * 100,
        netAPY: netAPY * 100,
        utilizationMultiplier: utilizationMultiplier * 100,
        demandMultiplier: demandMultiplier * 100,
        governanceBonus: governanceBonus * 100,
        totalEarningsProjection
      };

    } catch (error) {
      console.error('Error calculating sustainable APY:', error);
      // Return fallback APY
      return this.getFallbackAPY(params.token);
    }
  }

  /**
   * Calculate base APY based on utilization rate and asset type
   */
  private static calculateBaseAPY(utilization: number, token: string): number {
    // Base APY rates for different assets
    const baseRates: Record<string, { min: number; max: number }> = {
      USDC: { min: 0.02, max: 0.08 }, // 2-8%
      USDT: { min: 0.015, max: 0.075 }, // 1.5-7.5%
      DAI: { min: 0.025, max: 0.09 }, // 2.5-9%
      XAUT: { min: 0.03, max: 0.12 }, // 3-12% (higher due to commodity nature)
      AURU: { min: 0.05, max: 0.15 } // 5-15% (governance token)
    };

    const rate = baseRates[token] || baseRates.USDC;
    
    // Linear interpolation based on utilization
    return rate.min + (utilization * (rate.max - rate.min));
  }

  /**
   * Calculate dynamic platform fee based on market conditions
   */
  private static calculateDynamicPlatformFee(utilization: number, baseAPY: number): number {
    let feeRate = this.PLATFORM_BASE_FEE;

    // Increase fee during high utilization (more demand = higher fee)
    if (utilization > 0.8) {
      feeRate += 0.005; // Add 0.5%
    }

    // Increase fee during high APY periods (more profit = higher fee)
    if (baseAPY > 0.1) { // 10%
      feeRate += 0.002; // Add 0.2%
    }

    // Ensure fee stays within bounds
    return Math.max(this.MIN_PLATFORM_FEE, Math.min(this.MAX_PLATFORM_FEE, feeRate));
  }

  /**
   * Calculate utilization multiplier bonus
   */
  private static calculateUtilizationMultiplier(utilization: number): number {
    // Bonus for high utilization (rewards early suppliers)
    if (utilization > 0.7) {
      return 0.01; // 1% bonus
    } else if (utilization > 0.5) {
      return 0.005; // 0.5% bonus
    }
    return 0;
  }

  /**
   * Calculate demand multiplier based on recent deposit trends
   */
  private static async calculateDemandMultiplier(chain: string, token: string): Promise<number> {
    try {
      // Get recent supply transactions to measure demand
      const { data: recentSupplies } = await supabase
        .from('user_supplies')
        .select('supplied_amount_dec, created_at')
        .eq('chain', chain)
        .eq('asset', token)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('created_at', { ascending: false });

      if (!recentSupplies || recentSupplies.length === 0) {
        return 0;
      }

      // Calculate recent supply volume
      const recentVolume = recentSupplies.reduce((sum, supply) => sum + supply.supplied_amount_dec, 0);
      
      // Bonus based on recent supply volume (higher demand = higher APY)
      if (recentVolume > 100000) { // $100k+
        return 0.015; // 1.5% bonus
      } else if (recentVolume > 50000) { // $50k+
        return 0.01; // 1% bonus
      } else if (recentVolume > 10000) { // $10k+
        return 0.005; // 0.5% bonus
      }

      return 0;
    } catch (error) {
      console.error('Error calculating demand multiplier:', error);
      return 0;
    }
  }

  /**
   * Calculate governance bonus for AURU token holders
   */
  private static async calculateGovernanceBonus(): Promise<number> {
    try {
      // Check if user has AURU tokens
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data: auruBalance } = await supabase
        .from('user_supplies')
        .select('supplied_amount_dec')
        .eq('user_id', user.id)
        .eq('asset', 'AURU')
        .single();

      if (auruBalance && auruBalance.supplied_amount_dec > 0) {
        return this.GOVERNANCE_BONUS_RATE; // 0.2% bonus for AURU holders
      }

      return 0;
    } catch (error) {
      console.error('Error calculating governance bonus:', error);
      return 0;
    }
  }

  /**
   * Calculate earnings projection over time
   */
  private static calculateEarningsProjection(principal: number, apy: number, days: number): number {
    const dailyRate = apy / 100 / 365;
    return principal * dailyRate * days;
  }

  /**
   * Get fallback APY when calculation fails
   */
  private static getFallbackAPY(token: string): APYResult {
    const fallbackRates: Record<string, number> = {
      USDC: 3.5,
      USDT: 3.0,
      DAI: 4.0,
      XAUT: 5.0,
      AURU: 8.0
    };

    const baseAPY = fallbackRates[token] || 3.5;
    const platformFeeAPY = baseAPY * this.PLATFORM_BASE_FEE;
    const netAPY = baseAPY - platformFeeAPY;

    return {
      baseAPY,
      platformFeeAPY,
      netAPY,
      utilizationMultiplier: 0,
      demandMultiplier: 0,
      governanceBonus: 0,
      totalEarningsProjection: 0
    };
  }

  /**
   * Update edge function to use sustainable APY calculation
   */
  static async updateLendingRatesFunction(chain: string, token: string, termDays: number): Promise<number> {
    try {
      const result = await this.calculateSustainableAPY({ chain, token, termDays });
      return result.netAPY / 100; // Convert back to decimal for edge function
    } catch (error) {
      console.error('Error updating lending rates:', error);
      return 0.035; // 3.5% fallback
    }
  }

  /**
   * Get APY breakdown for display in UI
   */
  static async getAPYBreakdown(chain: string, token: string, amount?: number): Promise<{
    breakdown: APYResult;
    displayData: {
      grossAPY: string;
      platformFee: string;
      netAPY: string;
      bonuses: string[];
    };
  }> {
    const breakdown = await this.calculateSustainableAPY({ chain, token, amount });
    
    const bonuses: string[] = [];
    if (breakdown.utilizationMultiplier > 0) {
      bonuses.push(`+${breakdown.utilizationMultiplier.toFixed(2)}% Utilization Bonus`);
    }
    if (breakdown.demandMultiplier > 0) {
      bonuses.push(`+${breakdown.demandMultiplier.toFixed(2)}% Demand Bonus`);
    }
    if (breakdown.governanceBonus > 0) {
      bonuses.push(`+${breakdown.governanceBonus.toFixed(2)}% AURU Holder Bonus`);
    }

    return {
      breakdown,
      displayData: {
        grossAPY: `${(breakdown.baseAPY + breakdown.utilizationMultiplier + breakdown.demandMultiplier + breakdown.governanceBonus).toFixed(2)}%`,
        platformFee: `${breakdown.platformFeeAPY.toFixed(2)}%`,
        netAPY: `${breakdown.netAPY.toFixed(2)}%`,
        bonuses
      }
    };
  }
}