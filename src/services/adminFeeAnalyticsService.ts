import { supabase } from "@/integrations/supabase/client";

export interface FeeBreakdown {
  trading_fees: number;
  lending_fees: number;
  swap_fees: number;
  total_fees: number;
}

export interface CollectionStatus {
  collected_fees: number;
  pending_fees: number;
  success_rate: number;
}

export interface FeeActivity {
  date: string;
  amount: number;
  asset: string;
  transaction_type: string;
}

export interface MonthlyTrend {
  month: string;
  total_fees: number;
}

export interface FeeAnalytics {
  period: {
    start_date: string;
    end_date: string;
  };
  fee_breakdown: FeeBreakdown;
  collection_status: CollectionStatus;
  recent_activity: FeeActivity[];
  monthly_trends: MonthlyTrend[];
}

export interface FeeTypeMetrics {
  type: 'trading' | 'lending' | 'swap';
  total_amount: number;
  transaction_count: number;
  average_fee: number;
  last_24h: number;
  growth_rate: number;
}

class AdminFeeAnalyticsService {
  /**
   * Get comprehensive fee analytics for admin dashboard
   */
  async getFeeAnalytics(startDate?: string, endDate?: string): Promise<FeeAnalytics | null> {
    try {
      const { data, error } = await supabase.rpc('admin_get_fee_analytics', {
        start_date: startDate,
        end_date: endDate
      });

      if (error) {
        console.error('Error fetching fee analytics:', error);
        return null;
      }

      return data as unknown as FeeAnalytics;
    } catch (err) {
      console.error('Error in getFeeAnalytics:', err);
      return null;
    }
  }

  /**
   * Get detailed metrics for each fee type
   */
  async getFeeTypeMetrics(): Promise<FeeTypeMetrics[]> {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get trading fees
      const { data: tradingData, error: tradingError } = await supabase
        .from('transactions')
        .select('metadata, created_at')
        .in('type', ['buy', 'sell'])
        .eq('status', 'completed')
        .gte('created_at', last30Days.toISOString());

      if (tradingError) throw tradingError;

      const tradingFees = tradingData?.reduce((acc, tx) => {
        const fee = parseFloat((tx.metadata as any)?.platform_fee_usd || '0');
        const isLast24h = new Date(tx.created_at) >= last24h;
        return {
          total: acc.total + fee,
          count: acc.count + (fee > 0 ? 1 : 0),
          last24h: acc.last24h + (isLast24h ? fee : 0)
        };
      }, { total: 0, count: 0, last24h: 0 }) || { total: 0, count: 0, last24h: 0 };

      // Get lending fees
      const { data: lendingData, error: lendingError } = await supabase
        .from('payouts')
        .select('platform_fee_dec, ts')
        .gte('ts', last30Days.toISOString());

      if (lendingError) throw lendingError;

      const lendingFees = lendingData?.reduce((acc, payout) => {
        const fee = parseFloat(payout.platform_fee_dec?.toString() || '0');
        const isLast24h = new Date(payout.ts) >= last24h;
        return {
          total: acc.total + fee,
          count: acc.count + (fee > 0 ? 1 : 0),
          last24h: acc.last24h + (isLast24h ? fee : 0)
        };
      }, { total: 0, count: 0, last24h: 0 }) || { total: 0, count: 0, last24h: 0 };

      // Get swap fees
      const { data: swapData, error: swapError } = await supabase
        .from('transactions')
        .select('metadata, created_at')
        .eq('type', 'swap')
        .eq('status', 'completed')
        .gte('created_at', last30Days.toISOString());

      if (swapError) throw swapError;

      const swapFees = swapData?.reduce((acc, tx) => {
        const fee = parseFloat((tx.metadata as any)?.swap_fee_usd || '0');
        const isLast24h = new Date(tx.created_at) >= last24h;
        return {
          total: acc.total + fee,
          count: acc.count + (fee > 0 ? 1 : 0),
          last24h: acc.last24h + (isLast24h ? fee : 0)
        };
      }, { total: 0, count: 0, last24h: 0 }) || { total: 0, count: 0, last24h: 0 };

      const metrics: FeeTypeMetrics[] = [
        {
          type: 'trading',
          total_amount: tradingFees.total,
          transaction_count: tradingFees.count,
          average_fee: tradingFees.count > 0 ? tradingFees.total / tradingFees.count : 0,
          last_24h: tradingFees.last24h,
          growth_rate: this.calculateGrowthRate(tradingFees.total, tradingFees.last24h)
        },
        {
          type: 'lending',
          total_amount: lendingFees.total,
          transaction_count: lendingFees.count,
          average_fee: lendingFees.count > 0 ? lendingFees.total / lendingFees.count : 0,
          last_24h: lendingFees.last24h,
          growth_rate: this.calculateGrowthRate(lendingFees.total, lendingFees.last24h)
        },
        {
          type: 'swap',
          total_amount: swapFees.total,
          transaction_count: swapFees.count,
          average_fee: swapFees.count > 0 ? swapFees.total / swapFees.count : 0,
          last_24h: swapFees.last24h,
          growth_rate: this.calculateGrowthRate(swapFees.total, swapFees.last24h)
        }
      ];

      return metrics;
    } catch (err) {
      console.error('Error in getFeeTypeMetrics:', err);
      return [];
    }
  }

  /**
   * Get fee collection health status
   */
  async getCollectionHealth(): Promise<{
    totalRequests: number;
    successfulCollections: number;
    failedCollections: number;
    pendingCollections: number;
    avgCollectionTime: number;
    recentFailures: any[];
  }> {
    try {
      const { data, error } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const requests = data || [];
      const successful = requests.filter(r => r.status === 'completed');
      const failed = requests.filter(r => r.status === 'failed');
      const pending = requests.filter(r => r.status === 'pending');

      // Calculate average collection time for successful requests
      const avgCollectionTime = successful.length > 0 
        ? successful.reduce((acc, req) => {
            if (req.completed_at && req.created_at) {
              const diff = new Date(req.completed_at).getTime() - new Date(req.created_at).getTime();
              return acc + diff;
            }
            return acc;
          }, 0) / successful.length
        : 0;

      // Get recent failures for debugging
      const recentFailures = failed
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      return {
        totalRequests: requests.length,
        successfulCollections: successful.length,
        failedCollections: failed.length,
        pendingCollections: pending.length,
        avgCollectionTime: avgCollectionTime / (1000 * 60), // Convert to minutes
        recentFailures
      };
    } catch (err) {
      console.error('Error in getCollectionHealth:', err);
      return {
        totalRequests: 0,
        successfulCollections: 0,
        failedCollections: 0,
        pendingCollections: 0,
        avgCollectionTime: 0,
        recentFailures: []
      };
    }
  }

  /**
   * Get real-time fee collection monitoring data
   */
  async getRealtimeMonitoring(): Promise<{
    isCollectionBotRunning: boolean;
    lastCollectionAttempt: string | null;
    totalFeesThisHour: number;
    successRateThisHour: number;
    alertsCount: number;
  }> {
    try {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('fee_collection_requests')
        .select('*')
        .gte('created_at', hourAgo.toISOString());

      if (error) throw error;

      const requests = data || [];
      const successful = requests.filter(r => r.status === 'completed');
      const totalFeesThisHour = successful.reduce((acc, req) => acc + parseFloat(req.amount.toString()), 0);
      const successRateThisHour = requests.length > 0 ? (successful.length / requests.length) * 100 : 0;

      const lastRequest = requests.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      return {
        isCollectionBotRunning: true, // This would need to be determined by bot status
        lastCollectionAttempt: lastRequest?.created_at || null,
        totalFeesThisHour,
        successRateThisHour,
        alertsCount: requests.filter(r => r.status === 'failed').length
      };
    } catch (err) {
      console.error('Error in getRealtimeMonitoring:', err);
      return {
        isCollectionBotRunning: false,
        lastCollectionAttempt: null,
        totalFeesThisHour: 0,
        successRateThisHour: 0,
        alertsCount: 0
      };
    }
  }

  /**
   * Export detailed fee report
   */
  async exportDetailedFeeReport(startDate?: string, endDate?: string): Promise<string> {
    try {
      const analytics = await this.getFeeAnalytics(startDate, endDate);
      if (!analytics) return '';

      const headers = [
        'Period Start', 'Period End', 'Fee Type', 'Amount (USD)', 'Transaction Count', 
        'Collection Status', 'Growth Rate', 'Notes'
      ];

      const rows = [
        [
          analytics.period.start_date,
          analytics.period.end_date,
          'Trading Fees',
          analytics.fee_breakdown.trading_fees.toFixed(2),
          'N/A',
          'Active',
          'N/A',
          '1.0% of transaction value'
        ],
        [
          analytics.period.start_date,
          analytics.period.end_date,
          'Lending Fees',
          analytics.fee_breakdown.lending_fees.toFixed(2),
          'N/A',
          'Active',
          'N/A',
          '1.8% of earned interest'
        ],
        [
          analytics.period.start_date,
          analytics.period.end_date,
          'Swap Fees',
          analytics.fee_breakdown.swap_fees.toFixed(2),
          'N/A',
          'Active',
          'N/A',
          '1.0% of swap value'
        ],
        [
          analytics.period.start_date,
          analytics.period.end_date,
          'TOTAL',
          analytics.fee_breakdown.total_fees.toFixed(2),
          'N/A',
          `${analytics.collection_status.success_rate.toFixed(1)}% success rate`,
          'N/A',
          'All platform fees combined'
        ]
      ];

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    } catch (err) {
      console.error('Error in exportDetailedFeeReport:', err);
      return '';
    }
  }

  private calculateGrowthRate(total: number, last24h: number): number {
    if (total === 0) return 0;
    const dailyAverage = total / 30; // Assuming 30-day period
    if (dailyAverage === 0) return 0;
    return ((last24h - dailyAverage) / dailyAverage) * 100;
  }
}

export const adminFeeAnalyticsService = new AdminFeeAnalyticsService();