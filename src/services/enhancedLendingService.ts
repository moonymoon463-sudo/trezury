import { supabase } from '@/integrations/supabase/client';

export interface EnhancedAPYData {
  baseAPY: number;
  bonuses: {
    utilization: number;
    demand: number;
    governance: number;
  };
  grossAPY: number;
  platformFee: number;
  netAPY: number;
  breakdown: string[];
}

export interface RealTimeMetrics {
  totalValueLocked: number;
  utilization: number;
  avgSupplyAPY: number;
  avgBorrowAPY: number;
  healthFactor: number | null;
  lastUpdated: string;
}

export class EnhancedLendingService {
  /**
   * Get enhanced APY data with detailed breakdown
   */
  static async getEnhancedAPY(
    chain: string = 'ethereum',
    token: string,
    amount?: number
  ): Promise<EnhancedAPYData> {
    try {
      const { data, error } = await supabase.functions.invoke('lending-rates', {
        body: { chain, token, termDays: 365, amount: amount || 1000 }
      });

      if (error) throw error;

      const breakdown: string[] = [];
      
      if (data.base_apy > 0) {
        breakdown.push(`Base APY: ${data.base_apy.toFixed(2)}%`);
      }
      
      if (data.utilization_bonus > 0) {
        breakdown.push(`Utilization Bonus: +${data.utilization_bonus.toFixed(2)}%`);
      }
      
      if (data.demand_bonus > 0) {
        breakdown.push(`Demand Bonus: +${data.demand_bonus.toFixed(2)}%`);
      }
      
      if (data.platform_fee_rate > 0) {
        breakdown.push(`Platform Fee: -${(data.platform_fee_rate * 100).toFixed(1)}%`);
      }

      return {
        baseAPY: data.base_apy || 0,
        bonuses: {
          utilization: data.utilization_bonus || 0,
          demand: data.demand_bonus || 0,
          governance: 0 // Will be calculated separately
        },
        grossAPY: data.gross_apy || 0,
        platformFee: data.platform_fee_rate || 0,
        netAPY: data.apy || 0,
        breakdown
      };
    } catch (error) {
      console.error('Error getting enhanced APY:', error);
      // Return fallback data
      return {
        baseAPY: 2.5,
        bonuses: { utilization: 0, demand: 0, governance: 0 },
        grossAPY: 2.5,
        platformFee: 0.15,
        netAPY: 2.1,
        breakdown: ['Base APY: 2.50%', 'Platform Fee: -15%']
      };
    }
  }

  /**
   * Get real-time lending metrics
   */
  static async getRealTimeMetrics(chain: string = 'ethereum'): Promise<RealTimeMetrics> {
    try {
      // Get pool data
      const { data: pools, error: poolError } = await supabase
        .from('pool_reserves')
        .select('*')
        .eq('chain', chain)
        .eq('is_active', true);

      if (poolError) throw poolError;

      const totalValueLocked = pools?.reduce((sum, pool) => sum + pool.total_supply_dec, 0) || 0;
      const totalBorrowed = pools?.reduce((sum, pool) => sum + pool.total_borrowed_dec, 0) || 0;
      const utilization = totalValueLocked > 0 ? totalBorrowed / totalValueLocked : 0;
      
      const avgSupplyAPY = pools?.length > 0 
        ? pools.reduce((sum, pool) => sum + pool.supply_rate, 0) / pools.length 
        : 0;
      
      const avgBorrowAPY = pools?.length > 0 
        ? pools.reduce((sum, pool) => sum + pool.borrow_rate_variable, 0) / pools.length 
        : 0;

      // Get user health factor if authenticated
      let healthFactor: number | null = null;
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: healthData } = await supabase
          .from('user_health_factors')
          .select('health_factor')
          .eq('user_id', user.id)
          .eq('chain', chain)
          .maybeSingle();
        
        healthFactor = healthData?.health_factor || null;
      }

      return {
        totalValueLocked,
        utilization,
        avgSupplyAPY,
        avgBorrowAPY,
        healthFactor,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting real-time metrics:', error);
      // Return fallback data
      return {
        totalValueLocked: 9150000, // Sum of test data
        utilization: 0.65,
        avgSupplyAPY: 0.058,
        avgBorrowAPY: 0.068,
        healthFactor: null,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Trigger manual interest accrual (for testing)
   */
  static async triggerInterestAccrual(): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('auto-accrual');
      
      if (error) {
        console.error('Error triggering accrual:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error triggering accrual:', error);
      return false;
    }
  }

  /**
   * Get available lending markets
   */
  static async getAvailableMarkets(): Promise<any[]> {
    try {
      const { data, error } = await supabase.functions.invoke('lending-rates', {
        method: 'GET'
      });

      if (error) throw error;

      return data.tokens || [];
    } catch (error) {
      console.error('Error getting available markets:', error);
      return [
        {
          token: 'USDC',
          apyRange: '2.0% - 8.0%',
          platformFeeRate: '15.0%',
          description: 'USD Coin - Fully collateralized US dollar stablecoin'
        },
        {
          token: 'XAUT',
          apyRange: '3.0% - 12.0%',
          platformFeeRate: '18.0%',
          description: 'Tether Gold - Digital gold backed by physical gold'
        },
        {
          token: 'AURU',
          apyRange: '5.0% - 15.0%',
          platformFeeRate: '10.0%',
          description: 'Aurum Governance Token - Protocol governance and rewards'
        }
      ];
    }
  }

  /**
   * Calculate optimal allocation for a given amount
   */
  static async calculateOptimalAllocation(
    totalAmount: number,
    riskProfile: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
  ): Promise<any> {
    try {
      const markets = await this.getAvailableMarkets();
      const recommendations: any[] = [];

      for (const market of markets) {
        const apyData = await this.getEnhancedAPY('ethereum', market.token, totalAmount * 0.33);
        
        let allocation = 0;
        
        // Risk-based allocation
        if (riskProfile === 'conservative') {
          allocation = market.token === 'USDC' ? 0.6 : 
                     market.token === 'XAUT' ? 0.3 : 0.1;
        } else if (riskProfile === 'moderate') {
          allocation = market.token === 'USDC' ? 0.4 : 
                     market.token === 'XAUT' ? 0.4 : 0.2;
        } else { // aggressive
          allocation = market.token === 'USDC' ? 0.2 : 
                     market.token === 'XAUT' ? 0.3 : 0.5;
        }

        recommendations.push({
          token: market.token,
          allocation: allocation,
          amount: totalAmount * allocation,
          expectedAPY: apyData.netAPY,
          expectedReturn: (totalAmount * allocation) * (apyData.netAPY / 100),
          risk: market.token === 'USDC' ? 'Low' : 
                market.token === 'XAUT' ? 'Medium' : 'High'
        });
      }

      return {
        recommendations,
        totalExpectedReturn: recommendations.reduce((sum, rec) => sum + rec.expectedReturn, 0),
        averageAPY: recommendations.reduce((sum, rec) => sum + (rec.expectedAPY * rec.allocation), 0)
      };
    } catch (error) {
      console.error('Error calculating optimal allocation:', error);
      return {
        recommendations: [],
        totalExpectedReturn: 0,
        averageAPY: 0
      };
    }
  }
}