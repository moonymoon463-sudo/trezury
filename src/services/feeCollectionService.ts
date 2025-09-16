import { supabase } from "@/integrations/supabase/client";

export interface PlatformFeeRecord {
  transaction_id: string;
  fee_amount_usd: number;
  fee_asset: string;
  collected_at: string;
  transaction_type: 'buy' | 'sell' | 'swap';
}

export interface FeeCollectionSummary {
  total_fees_usd: number;
  total_fees_usdc: number;
  total_fees_gold: number;
  uncollected_fees_usd: number;
  transaction_count: number;
}

class FeeCollectionService {
  private readonly PLATFORM_FEE_WALLET = '0x742e4b5c0a2b4c1e9d8a7f6e5d4c3b2a1098765a';

  /**
   * Get all collected platform fees
   */
  async getCollectedFees(): Promise<PlatformFeeRecord[]> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          created_at,
          type,
          asset,
          fee_usd,
          metadata
        `)
        .not('metadata->platform_fee_usd', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching platform fees:', error);
        return [];
      }

      return (data || []).map(transaction => ({
        transaction_id: transaction.id,
        fee_amount_usd: parseFloat((transaction.metadata as any)?.platform_fee_usd || '0'),
        fee_asset: transaction.asset,
        collected_at: transaction.created_at,
        transaction_type: transaction.type as 'buy' | 'sell' | 'swap'
      }));
    } catch (err) {
      console.error('Error in getCollectedFees:', err);
      return [];
    }
  }

  /**
   * Get summary of all platform fees
   */
  async getFeeCollectionSummary(): Promise<FeeCollectionSummary> {
    try {
      const fees = await this.getCollectedFees();
      
      const summary = fees.reduce((acc, fee) => {
        acc.total_fees_usd += fee.fee_amount_usd;
        acc.transaction_count += 1;
        
        if (fee.fee_asset === 'USDC') {
          acc.total_fees_usdc += fee.fee_amount_usd;
        } else if (fee.fee_asset === 'GOLD' || fee.fee_asset === 'XAUT') {
          // Convert gold fees to USD equivalent at current rates
          acc.total_fees_gold += fee.fee_amount_usd;
        }
        
        return acc;
      }, {
        total_fees_usd: 0,
        total_fees_usdc: 0,
        total_fees_gold: 0,
        uncollected_fees_usd: 0,
        transaction_count: 0
      });

      // For now, assume all fees are uncollected until withdrawal mechanism is implemented
      summary.uncollected_fees_usd = summary.total_fees_usd;

      return summary;
    } catch (err) {
      console.error('Error in getFeeCollectionSummary:', err);
      return {
        total_fees_usd: 0,
        total_fees_usdc: 0,
        total_fees_gold: 0,
        uncollected_fees_usd: 0,
        transaction_count: 0
      };
    }
  }

  /**
   * Get platform fee wallet address
   */
  getPlatformWallet(): string {
    return this.PLATFORM_FEE_WALLET;
  }

  /**
   * Calculate fees collected in a date range
   */
  async getFeesInDateRange(startDate: string, endDate: string): Promise<PlatformFeeRecord[]> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          created_at,
          type,
          asset,
          fee_usd,
          metadata
        `)
        .not('metadata->platform_fee_usd', 'is', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching fees in date range:', error);
        return [];
      }

      return (data || []).map(transaction => ({
        transaction_id: transaction.id,
        fee_amount_usd: parseFloat((transaction.metadata as any)?.platform_fee_usd || '0'),
        fee_asset: transaction.asset,
        collected_at: transaction.created_at,
        transaction_type: transaction.type as 'buy' | 'sell' | 'swap'
      }));
    } catch (err) {
      console.error('Error in getFeesInDateRange:', err);
      return [];
    }
  }

  /**
   * Export fee collection report as CSV data
   */
  async exportFeeReport(): Promise<string> {
    const fees = await this.getCollectedFees();
    
    const headers = ['Transaction ID', 'Date', 'Type', 'Asset', 'Fee Amount (USD)', 'Platform Wallet'];
    const rows = fees.map(fee => [
      fee.transaction_id,
      new Date(fee.collected_at).toISOString().split('T')[0],
      fee.transaction_type,
      fee.fee_asset,
      fee.fee_amount_usd.toFixed(2),
      this.PLATFORM_FEE_WALLET
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    return csvContent;
  }
}

export const feeCollectionService = new FeeCollectionService();