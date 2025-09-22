import { supabase } from "@/integrations/supabase/client";

export interface DynamicFeeStructure {
  baseFeeRate: number;
  volumeMultiplier: number;
  loyaltyDiscount: number;
  activityBonus: number;
  effectiveRate: number;
}

export interface RevenueShare {
  userId: string;
  auruBalance: number;
  sharePercentage: number;
  monthlyRevenue: number;
  nextDistribution: string;
}

export interface TreasuryMetrics {
  totalRevenue: number;
  monthlyRevenue: number;
  distributedRewards: number;
  reserveBalance: number;
  govTokensStaked: number;
}

export class FeeOptimizationService {
  
  static async calculateDynamicFees(
    userId: string,
    amount: number,
    operation: 'supply' | 'borrow' | 'swap'
  ): Promise<DynamicFeeStructure> {
    try {
      const response = await supabase.functions.invoke('dynamic-fee-calculation', {
        body: { 
          action: 'calculate_fees',
          user_id: userId,
          amount,
          operation
        }
      });

      if (response.error) {
        throw new Error(`Failed to calculate dynamic fees: ${response.error.message}`);
      }

      return response.data.fee_structure;
    } catch (error) {
      console.error('Error calculating dynamic fees:', error);
      // Fallback to base rates
      return {
        baseFeeRate: 0.001, // 0.1%
        volumeMultiplier: 1.0,
        loyaltyDiscount: 0,
        activityBonus: 0,
        effectiveRate: 0.001
      };
    }
  }

  static async getRevenueShareInfo(userId: string): Promise<RevenueShare | null> {
    try {
      const response = await supabase.functions.invoke('revenue-sharing', {
        body: { 
          action: 'get_user_share',
          user_id: userId
        }
      });

      if (response.error) {
        throw new Error(`Failed to get revenue share info: ${response.error.message}`);
      }

      return response.data.revenue_share;
    } catch (error) {
      console.error('Error getting revenue share info:', error);
      return null;
    }
  }

  static async distributePendingRewards(): Promise<void> {
    try {
      const response = await supabase.functions.invoke('revenue-sharing', {
        body: { action: 'distribute_rewards' }
      });

      if (response.error) {
        throw new Error(`Failed to distribute rewards: ${response.error.message}`);
      }
    } catch (error) {
      console.error('Error distributing rewards:', error);
      throw error;
    }
  }

  static async getTreasuryMetrics(): Promise<TreasuryMetrics> {
    try {
      const response = await supabase.functions.invoke('treasury-management', {
        body: { action: 'get_metrics' }
      });

      if (response.error) {
        throw new Error(`Failed to get treasury metrics: ${response.error.message}`);
      }

      return response.data.metrics;
    } catch (error) {
      console.error('Error getting treasury metrics:', error);
      // Return default metrics
      return {
        totalRevenue: 0,
        monthlyRevenue: 0,
        distributedRewards: 0,
        reserveBalance: 0,
        govTokensStaked: 0
      };
    }
  }

  static async optimizeFeeCollection(chain: string): Promise<void> {
    try {
      const response = await supabase.functions.invoke('fee-optimization', {
        body: { 
          action: 'optimize_collection',
          chain
        }
      });

      if (response.error) {
        throw new Error(`Failed to optimize fee collection: ${response.error.message}`);
      }
    } catch (error) {
      console.error('Error optimizing fee collection:', error);
      throw error;
    }
  }

  static async getFeeCollectionHistory(days: number = 30): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting fee collection history:', error);
      throw error;
    }
  }

  static calculateLoyaltyDiscount(userActivity: {
    totalVolume: number;
    monthsActive: number;
    auruStaked: number;
  }): number {
    let discount = 0;
    
    // Volume-based discount (up to 20%)
    if (userActivity.totalVolume > 1000000) discount += 0.20;
    else if (userActivity.totalVolume > 500000) discount += 0.15;
    else if (userActivity.totalVolume > 100000) discount += 0.10;
    else if (userActivity.totalVolume > 50000) discount += 0.05;
    
    // Loyalty-based discount (up to 10%)
    if (userActivity.monthsActive > 12) discount += 0.10;
    else if (userActivity.monthsActive > 6) discount += 0.05;
    
    // AURU staking discount (up to 15%)
    if (userActivity.auruStaked > 100000) discount += 0.15;
    else if (userActivity.auruStaked > 50000) discount += 0.10;
    else if (userActivity.auruStaked > 10000) discount += 0.05;
    
    return Math.min(discount, 0.40); // Cap at 40% total discount
  }

  static formatFeeRate(rate: number): string {
    return `${(rate * 100).toFixed(3)}%`;
  }

  static formatUsdAmount(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}