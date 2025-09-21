import { supabase } from "@/integrations/supabase/client";

export interface HistoricalPosition {
  date: string;
  supplied_amount: number;
  borrowed_amount: number;
  net_apy: number;
  health_factor: number;
  pnl_usd: number;
}

export interface PerformanceMetrics {
  total_interest_earned: number;
  total_interest_paid: number;
  net_profit_loss: number;
  average_health_factor: number;
  best_performing_asset: string;
  worst_performing_asset: string;
  days_active: number;
  liquidation_events: number;
}

export interface PortfolioInsight {
  type: 'optimization' | 'risk' | 'opportunity' | 'market';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  action_items: string[];
}

export class HistoricalAnalyticsService {

  static async getPositionHistory(
    userId: string, 
    days: number = 30,
    chain: string = 'ethereum'
  ): Promise<HistoricalPosition[]> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

      // Get balance snapshots for the period
      const { data: snapshots, error } = await supabase
        .from('balance_snapshots')
        .select('*')
        .eq('user_id', userId)
        .gte('snapshot_at', startDate.toISOString())
        .lte('snapshot_at', endDate.toISOString())
        .order('snapshot_at', { ascending: true });

      if (error) throw error;

      // Group snapshots by date and calculate daily positions
      const dailyPositions = new Map<string, HistoricalPosition>();

      for (const snapshot of snapshots || []) {
        const date = snapshot.snapshot_at.split('T')[0];
        
        if (!dailyPositions.has(date)) {
          dailyPositions.set(date, {
            date,
            supplied_amount: 0,
            borrowed_amount: 0,
            net_apy: 0,
            health_factor: 0,
            pnl_usd: 0
          });
        }

        const position = dailyPositions.get(date)!;
        
        if (snapshot.amount > 0) {
          position.supplied_amount += snapshot.amount;
        } else {
          position.borrowed_amount += Math.abs(snapshot.amount);
        }
      }

      // Get health factor history
      const { data: healthHistory, error: healthError } = await supabase
        .from('user_health_factors')
        .select('*')
        .eq('user_id', userId)
        .eq('chain', chain)
        .gte('last_calculated_at', startDate.toISOString())
        .order('last_calculated_at', { ascending: true });

      if (healthError) console.error('Error fetching health history:', healthError);

      // Merge health factor data
      for (const healthRecord of healthHistory || []) {
        const date = healthRecord.last_calculated_at.split('T')[0];
        const position = dailyPositions.get(date);
        if (position) {
          position.health_factor = healthRecord.health_factor;
        }
      }

      // Calculate APY and P&L for each position
      const positions = Array.from(dailyPositions.values());
      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        
        // Mock APY calculation (in production, use actual rate data)
        if (position.supplied_amount > 0 && position.borrowed_amount > 0) {
          position.net_apy = (position.supplied_amount * 0.05 - position.borrowed_amount * 0.07) / position.supplied_amount * 100;
        } else if (position.supplied_amount > 0) {
          position.net_apy = 5.0; // 5% supply APY
        } else if (position.borrowed_amount > 0) {
          position.net_apy = -7.0; // -7% borrow APY
        }

        // Calculate daily P&L
        if (i > 0) {
          const previousPosition = positions[i - 1];
          const dailyReturn = (position.supplied_amount - position.borrowed_amount) - 
                             (previousPosition.supplied_amount - previousPosition.borrowed_amount);
          position.pnl_usd = previousPosition.pnl_usd + dailyReturn;
        }
      }

      return positions;

    } catch (error) {
      console.error('Error fetching position history:', error);
      throw error;
    }
  }

  static async getPerformanceMetrics(
    userId: string,
    days: number = 30,
    chain: string = 'ethereum'
  ): Promise<PerformanceMetrics> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

      // Get user's supply and borrow positions
      const [suppliesResponse, borrowsResponse, liquidationsResponse] = await Promise.all([
        supabase
          .from('user_supplies')
          .select('*')
          .eq('user_id', userId)
          .eq('chain', chain),
        supabase
          .from('user_borrows')
          .select('*')
          .eq('user_id', userId)
          .eq('chain', chain),
        supabase
          .from('liquidation_calls')
          .select('*')
          .eq('user_id', userId)
          .eq('chain', chain)
          .gte('created_at', startDate.toISOString())
      ]);

      if (suppliesResponse.error) throw suppliesResponse.error;
      if (borrowsResponse.error) throw borrowsResponse.error;
      if (liquidationsResponse.error) throw liquidationsResponse.error;

      const supplies = suppliesResponse.data || [];
      const borrows = borrowsResponse.data || [];
      const liquidations = liquidationsResponse.data || [];

      // Calculate total interest earned
      const totalInterestEarned = supplies.reduce((sum, supply) => 
        sum + supply.accrued_interest_dec, 0
      );

      // Calculate total interest paid
      const totalInterestPaid = borrows.reduce((sum, borrow) => 
        sum + borrow.accrued_interest_dec, 0
      );

      // Calculate net P&L
      const netProfitLoss = totalInterestEarned - totalInterestPaid;

      // Get health factor history for average calculation
      const { data: healthHistory } = await supabase
        .from('user_health_factors')
        .select('health_factor')
        .eq('user_id', userId)
        .eq('chain', chain)
        .gte('last_calculated_at', startDate.toISOString());

      const averageHealthFactor = healthHistory?.length > 0 
        ? healthHistory.reduce((sum, h) => sum + h.health_factor, 0) / healthHistory.length
        : 0;

      // Find best and worst performing assets
      const assetPerformance = new Map<string, number>();
      
      supplies.forEach(supply => {
        const performance = supply.accrued_interest_dec / supply.supplied_amount_dec * 100;
        assetPerformance.set(supply.asset, performance);
      });

      borrows.forEach(borrow => {
        const cost = borrow.accrued_interest_dec / borrow.borrowed_amount_dec * 100;
        const currentPerf = assetPerformance.get(borrow.asset) || 0;
        assetPerformance.set(borrow.asset, currentPerf - cost);
      });

      const sortedAssets = Array.from(assetPerformance.entries())
        .sort((a, b) => b[1] - a[1]);

      const bestPerformingAsset = sortedAssets.length > 0 ? sortedAssets[0][0] : 'N/A';
      const worstPerformingAsset = sortedAssets.length > 0 ? sortedAssets[sortedAssets.length - 1][0] : 'N/A';

      return {
        total_interest_earned: totalInterestEarned,
        total_interest_paid: totalInterestPaid,
        net_profit_loss: netProfitLoss,
        average_health_factor: averageHealthFactor,
        best_performing_asset: bestPerformingAsset,
        worst_performing_asset: worstPerformingAsset,
        days_active: days,
        liquidation_events: liquidations.length
      };

    } catch (error) {
      console.error('Error calculating performance metrics:', error);
      throw error;
    }
  }

  static async generatePortfolioInsights(
    userId: string,
    chain: string = 'ethereum'
  ): Promise<PortfolioInsight[]> {
    try {
      const insights: PortfolioInsight[] = [];

      // Get current positions and metrics
      const [performance, currentHealth] = await Promise.all([
        this.getPerformanceMetrics(userId, 30, chain),
        supabase
          .from('user_health_factors')
          .select('*')
          .eq('user_id', userId)
          .eq('chain', chain)
          .single()
      ]);

      // Risk Analysis Insights
      if (currentHealth.data?.health_factor && currentHealth.data.health_factor < 1.5) {
        insights.push({
          type: 'risk',
          title: 'Health Factor Below Safe Threshold',
          description: `Your health factor is ${currentHealth.data.health_factor.toFixed(3)}, which is below the recommended minimum of 1.5.`,
          severity: currentHealth.data.health_factor < 1.1 ? 'critical' : 'warning',
          action_items: [
            'Consider repaying some borrowed assets',
            'Add more collateral to your positions',
            'Monitor your positions more frequently'
          ]
        });
      }

      // Performance Analysis Insights
      if (performance.net_profit_loss < 0) {
        insights.push({
          type: 'optimization',
          title: 'Negative Net Returns',
          description: `You're currently losing $${Math.abs(performance.net_profit_loss).toFixed(2)} due to borrowing costs exceeding lending returns.`,
          severity: 'warning',
          action_items: [
            'Review your borrowing strategy',
            'Consider reducing borrowed amounts',
            'Look for higher-yield lending opportunities'
          ]
        });
      }

      // Liquidation Risk Insights
      if (performance.liquidation_events > 0) {
        insights.push({
          type: 'risk',
          title: 'Recent Liquidation Activity',
          description: `You had ${performance.liquidation_events} liquidation event(s) in the past 30 days.`,
          severity: 'critical',
          action_items: [
            'Review risk management strategies',
            'Consider more conservative position sizing',
            'Set up automated health factor alerts'
          ]
        });
      }

      // Market Opportunity Insights
      const { data: marketRates } = await supabase
        .from('pool_reserves')
        .select('asset, supply_rate, borrow_rate_variable')
        .eq('chain', chain)
        .eq('is_active', true)
        .order('supply_rate', { ascending: false })
        .limit(3);

      if (marketRates && marketRates.length > 0) {
        const bestRate = marketRates[0];
        insights.push({
          type: 'opportunity',
          title: 'High-Yield Opportunity Available',
          description: `${bestRate.asset} is currently offering ${(bestRate.supply_rate * 100).toFixed(2)}% APY for suppliers.`,
          severity: 'info',
          action_items: [
            `Consider supplying ${bestRate.asset} for higher returns`,
            'Compare rates across different chains',
            'Evaluate risk vs. reward for new positions'
          ]
        });
      }

      // Diversification Insights
      const { data: userPositions } = await supabase
        .from('user_supplies')
        .select('asset, supplied_amount_dec')
        .eq('user_id', userId)
        .eq('chain', chain);

      if (userPositions && userPositions.length > 0) {
        const totalSupplied = userPositions.reduce((sum, pos) => sum + pos.supplied_amount_dec, 0);
        const largestPosition = Math.max(...userPositions.map(pos => pos.supplied_amount_dec));
        const concentration = (largestPosition / totalSupplied) * 100;

        if (concentration > 70) {
          insights.push({
            type: 'risk',
            title: 'High Asset Concentration',
            description: `${concentration.toFixed(1)}% of your portfolio is concentrated in a single asset.`,
            severity: 'warning',
            action_items: [
              'Consider diversifying across multiple assets',
              'Evaluate correlation risks between your holdings',
              'Gradually rebalance your portfolio over time'
            ]
          });
        }
      }

      // APY Optimization Insights
      if (performance.best_performing_asset && performance.worst_performing_asset) {
        insights.push({
          type: 'optimization',
          title: 'Asset Performance Variation',
          description: `${performance.best_performing_asset} is your best performer while ${performance.worst_performing_asset} is underperforming.`,
          severity: 'info',
          action_items: [
            `Consider increasing allocation to ${performance.best_performing_asset}`,
            `Review strategy for ${performance.worst_performing_asset}`,
            'Monitor relative performance trends'
          ]
        });
      }

      return insights;

    } catch (error) {
      console.error('Error generating portfolio insights:', error);
      throw error;
    }
  }

  static async getAPYTrends(days: number = 30): Promise<any[]> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

      // This would typically fetch historical APY data
      // For now, we'll simulate the data
      const trends = [];
      const assets = ['USDC', 'USDT', 'DAI', 'XAUT', 'AURU'];
      
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
        const dateStr = date.toISOString().split('T')[0];
        
        for (const asset of assets) {
          // Simulate APY fluctuations
          const baseAPY = asset === 'USDC' ? 0.045 : asset === 'USDT' ? 0.038 : 
                         asset === 'DAI' ? 0.052 : asset === 'XAUT' ? 0.088 : 0.125;
          const variation = (Math.random() - 0.5) * 0.01; // ±0.5% variation
          const apy = Math.max(0.001, baseAPY + variation);
          
          trends.push({
            date: dateStr,
            asset,
            supply_apy: apy,
            borrow_apy: apy + 0.02, // 2% spread
            utilization: Math.random() * 0.8 + 0.1 // 10-90% utilization
          });
        }
      }

      return trends;

    } catch (error) {
      console.error('Error fetching APY trends:', error);
      throw error;
    }
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  static formatPercentage(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }

  static formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  static calculateChangePercentage(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }
}