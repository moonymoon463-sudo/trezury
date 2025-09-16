import { supabase } from "@/integrations/supabase/client";

export interface UncollectedFee {
  transaction_id: string;
  user_id: string;
  fee_amount_usd: number;
  fee_asset: 'USDC' | 'XAUT';
  user_address: string;
  created_at: string;
}

export interface FeeCollectionRequestResult {
  success: boolean;
  request_id?: string;
  error?: string;
  fee_amount: number;
  asset: string;
}

class ExternalWalletFeeCollectionBot {
  private readonly COLLECTION_INTERVAL_MS = 300000; // 5 minutes
  private readonly PLATFORM_WALLET = '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835';
  private isRunning = false;

  /**
   * Start automated fee collection request generation
   */
  start(): void {
    if (this.isRunning) {
      console.log('External wallet fee collection bot is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting external wallet fee collection bot...');
    
    // Run immediately, then on interval
    this.generateAllPendingFeeRequests();
    
    setInterval(() => {
      this.generateAllPendingFeeRequests();
    }, this.COLLECTION_INTERVAL_MS);
  }

  /**
   * Stop automated fee collection request generation
   */
  stop(): void {
    this.isRunning = false;
    console.log('External wallet fee collection bot stopped');
  }

  /**
   * Generate fee collection requests for all pending platform fees
   */
  async generateAllPendingFeeRequests(): Promise<FeeCollectionRequestResult[]> {
    try {
      console.log('Scanning for uncollected fees to generate collection requests...');
      
      const uncollectedFees = await this.getUncollectedFees();
      
      if (uncollectedFees.length === 0) {
        console.log('No uncollected fees found');
        return [];
      }

      console.log(`Found ${uncollectedFees.length} uncollected fees, generating collection requests`);
      
      const results: FeeCollectionRequestResult[] = [];
      
      for (const fee of uncollectedFees) {
        try {
          const result = await this.generateFeeCollectionRequest(fee);
          results.push(result);
          
          if (result.success) {
            console.log(`✅ Generated collection request for ${result.fee_amount} ${result.asset} from user ${fee.user_id}`);
          } else {
            console.error(`❌ Failed to generate collection request for user ${fee.user_id}: ${result.error}`);
          }
          
          // Small delay between requests to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`Error generating fee collection request for transaction ${fee.transaction_id}:`, err);
          results.push({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
            fee_amount: fee.fee_amount_usd,
            asset: fee.fee_asset
          });
        }
      }
      
      return results;
    } catch (err) {
      console.error('Error in fee collection request generation process:', err);
      return [];
    }
  }

  /**
   * Generate a fee collection request for external wallet processing
   */
  private async generateFeeCollectionRequest(fee: UncollectedFee): Promise<FeeCollectionRequestResult> {
    try {
      // Check if a request already exists for this transaction
      const { data: existingRequest } = await supabase
        .from('fee_collection_requests')
        .select('id')
        .eq('transaction_id', fee.transaction_id)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        return {
          success: true,
          request_id: existingRequest.id,
          fee_amount: fee.fee_amount_usd,
          asset: fee.fee_asset
        };
      }

      // Create new fee collection request
      const { data: request, error } = await supabase
        .from('fee_collection_requests')
        .insert({
          user_id: fee.user_id,
          transaction_id: fee.transaction_id,
          from_address: fee.user_address,
          to_address: this.PLATFORM_WALLET,
          amount: fee.fee_amount_usd,
          asset: fee.fee_asset,
          status: 'pending',
          metadata: {
            generated_at: new Date().toISOString(),
            original_transaction: fee.transaction_id,
            fee_type: 'platform_service_fee'
          }
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create fee collection request: ${error.message}`);
      }

      return {
        success: true,
        request_id: request.id,
        fee_amount: fee.fee_amount_usd,
        asset: fee.fee_asset
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Fee collection request generation failed',
        fee_amount: fee.fee_amount_usd,
        asset: fee.fee_asset
      };
    }
  }

  /**
   * Get all uncollected fees from the database
   */
  private async getUncollectedFees(): Promise<UncollectedFee[]> {
    try {
      // Query transactions that have platform fees but haven't been collected yet
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          id,
          user_id,
          metadata,
          created_at,
          profiles!inner(id)
        `)
        .not('metadata->platform_fee_usd', 'is', null)
        .is('metadata->platform_fee_collected', null)
        .eq('status', 'completed')
        .order('created_at', { ascending: true })
        .limit(50); // Process in batches

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        return [];
      }

      const uncollectedFees: UncollectedFee[] = [];

      for (const tx of transactions) {
        try {
          const platformFeeUsd = parseFloat((tx.metadata as any)?.platform_fee_usd || '0');
          
          if (platformFeeUsd <= 0) continue;

          // Get user's wallet address
          const { data: addresses } = await supabase
            .from('onchain_addresses')
            .select('address')
            .eq('user_id', tx.user_id)
            .eq('asset', 'USDC') // Default to USDC address
            .limit(1);

          if (!addresses || addresses.length === 0) {
            console.warn(`No wallet address found for user ${tx.user_id}`);
            continue;
          }

          uncollectedFees.push({
            transaction_id: tx.id,
            user_id: tx.user_id,
            fee_amount_usd: platformFeeUsd,
            fee_asset: 'USDC', // Platform fees collected in USDC
            user_address: addresses[0].address,
            created_at: tx.created_at
          });
        } catch (err) {
          console.error(`Error processing transaction ${tx.id}:`, err);
        }
      }

      return uncollectedFees;
    } catch (err) {
      console.error('Error fetching uncollected fees:', err);
      return [];
    }
  }

  /**
   * Get fee collection statistics including requests
   */
  async getFeeCollectionStats(): Promise<{
    total_collected_usd: number;
    total_pending_requests_usd: number;
    total_uncollected_usd: number;
    collection_count: number;
    pending_requests_count: number;
    last_collection: string | null;
  }> {
    try {
      // Get fee collection requests
      const { data: requests } = await supabase
        .from('fee_collection_requests')
        .select('amount, status, completed_at');

      // Get transactions with platform fees
      const { data: transactions } = await supabase
        .from('transactions')
        .select('metadata, created_at')
        .not('metadata->platform_fee_usd', 'is', null);

      if (!transactions) {
        return {
          total_collected_usd: 0,
          total_pending_requests_usd: 0,
          total_uncollected_usd: 0,
          collection_count: 0,
          pending_requests_count: 0,
          last_collection: null
        };
      }

      let totalCollected = 0;
      let totalUncollected = 0;
      let collectionCount = 0;
      let lastCollection: string | null = null;

      // Calculate from requests
      const totalPendingRequests = requests?.filter(r => r.status === 'pending')
        .reduce((sum, r) => sum + Number(r.amount), 0) || 0;
      const pendingRequestsCount = requests?.filter(r => r.status === 'pending').length || 0;

      // Calculate from transactions
      for (const tx of transactions) {
        const feeAmount = parseFloat((tx.metadata as any)?.platform_fee_usd || '0');
        const isCollected = (tx.metadata as any)?.platform_fee_collected;

        if (isCollected) {
          totalCollected += feeAmount;
          collectionCount++;
          if (!lastCollection || tx.created_at > lastCollection) {
            lastCollection = tx.created_at;
          }
        } else {
          totalUncollected += feeAmount;
        }
      }

      return {
        total_collected_usd: Number(totalCollected.toFixed(2)),
        total_pending_requests_usd: Number(totalPendingRequests.toFixed(2)),
        total_uncollected_usd: Number(totalUncollected.toFixed(2)),
        collection_count: collectionCount,
        pending_requests_count: pendingRequestsCount,
        last_collection: lastCollection
      };
    } catch (err) {
      console.error('Error getting fee collection stats:', err);
      return {
        total_collected_usd: 0,
        total_pending_requests_usd: 0,
        total_uncollected_usd: 0,
        collection_count: 0,
        pending_requests_count: 0,
        last_collection: null
      };
    }
  }

  /**
   * Manual collection trigger for admin use
   */
  async collectAllPendingFees(): Promise<FeeCollectionRequestResult[]> {
    console.log('Manual fee collection triggered - generating collection requests for external wallet processing');
    return this.generateAllPendingFeeRequests();
  }
}

// Export singleton instance
export const externalWalletFeeCollectionBot = new ExternalWalletFeeCollectionBot();