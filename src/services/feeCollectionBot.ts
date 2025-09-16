import { supabase } from "@/integrations/supabase/client";
import { blockchainService } from "./blockchainService";

export interface UncollectedFee {
  transaction_id: string;
  user_id: string;
  fee_amount_usd: number;
  fee_asset: 'USDC' | 'XAUT';
  user_address: string;
  created_at: string;
}

export interface FeeCollectionResult {
  success: boolean;
  transaction_hash?: string;
  error?: string;
  fee_amount: number;
  asset: string;
}

class FeeCollectionBot {
  private readonly COLLECTION_INTERVAL_MS = 300000; // 5 minutes
  private readonly PLATFORM_WALLET = 'BzSNDYfdEf8Q2wpr3rvrqQyreAWqB25AnmQA6XohUNom';
  private isRunning = false;

  /**
   * Start automated fee collection
   */
  start(): void {
    if (this.isRunning) {
      console.log('Fee collection bot is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting automated fee collection bot...');
    
    // Run immediately, then on interval
    this.collectAllPendingFees();
    
    setInterval(() => {
      this.collectAllPendingFees();
    }, this.COLLECTION_INTERVAL_MS);
  }

  /**
   * Stop automated fee collection
   */
  stop(): void {
    this.isRunning = false;
    console.log('Fee collection bot stopped');
  }

  /**
   * Collect all pending platform fees
   */
  async collectAllPendingFees(): Promise<FeeCollectionResult[]> {
    try {
      console.log('Scanning for uncollected fees...');
      
      const uncollectedFees = await this.getUncollectedFees();
      
      if (uncollectedFees.length === 0) {
        console.log('No uncollected fees found');
        return [];
      }

      console.log(`Found ${uncollectedFees.length} uncollected fees`);
      
      const results: FeeCollectionResult[] = [];
      
      for (const fee of uncollectedFees) {
        try {
          const result = await this.collectSingleFee(fee);
          results.push(result);
          
          if (result.success) {
            console.log(`✅ Collected ${result.fee_amount} ${result.asset} from user ${fee.user_id}`);
          } else {
            console.error(`❌ Failed to collect fee from user ${fee.user_id}: ${result.error}`);
          }
          
          // Small delay between collections to avoid overwhelming the network
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.error(`Error collecting fee for transaction ${fee.transaction_id}:`, err);
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
      console.error('Error in fee collection process:', err);
      return [];
    }
  }

  /**
   * Collect a single platform fee
   */
  private async collectSingleFee(fee: UncollectedFee): Promise<FeeCollectionResult> {
    try {
      // Verify user has sufficient balance before attempting collection
      const userBalance = await blockchainService.getTokenBalance(fee.user_address, fee.fee_asset);
      
      if (userBalance < fee.fee_amount_usd) {
        return {
          success: false,
          error: `Insufficient balance: ${userBalance} < ${fee.fee_amount_usd}`,
          fee_amount: fee.fee_amount_usd,
          asset: fee.fee_asset
        };
      }

      // Execute the fee collection transfer
      const transfer = await blockchainService.collectPlatformFee(
        fee.user_address,
        fee.fee_amount_usd,
        fee.fee_asset,
        fee.user_id,
        fee.transaction_id
      );

      // Mark fee as collected in the transaction record
      await this.markFeeAsCollected(fee.transaction_id, transfer.hash);

      // Send notification to user (optional)
      await this.sendFeeCollectionNotification(fee.user_id, fee.fee_amount_usd, fee.fee_asset);

      return {
        success: true,
        transaction_hash: transfer.hash,
        fee_amount: fee.fee_amount_usd,
        asset: fee.fee_asset
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Fee collection failed',
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
        .is('metadata->platformFeeCollected', null)
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
   * Mark a fee as collected in the database
   */
  private async markFeeAsCollected(transactionId: string, transferHash: string): Promise<void> {
    try {
      // Get current metadata and update it
      const { data: currentTransaction, error: fetchError } = await supabase
        .from('transactions')
        .select('metadata')
        .eq('id', transactionId)
        .single();

      if (fetchError) {
        console.error('Failed to fetch transaction for fee marking:', fetchError);
        return;
      }

      // Merge new fee collection data with existing metadata
      const updatedMetadata = {
        ...(currentTransaction.metadata as any || {}),
        platformFeeCollected: true,
        feeTransactionHash: transferHash,
        feeCollectedAt: new Date().toISOString()
      };

      const { error } = await supabase
        .from('transactions')
        .update({
          metadata: updatedMetadata
        })
        .eq('id', transactionId);

      if (error) {
        console.error('Failed to mark fee as collected:', error);
      }

      // Also record the fee collection as a separate balance snapshot for tracking
      await supabase
        .from('balance_snapshots')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // System user for platform fees
          asset: 'USDC',
          amount: 0, // Just for tracking, actual amount in metadata
          snapshot_at: new Date().toISOString()
        });
    } catch (err) {
      console.error('Error marking fee as collected:', err);
    }
  }

  /**
   * Send notification to user about fee collection
   */
  private async sendFeeCollectionNotification(
    userId: string, 
    amount: number, 
    asset: string
  ): Promise<void> {
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          kind: 'fee_collection',
          title: 'Platform Fee Collected',
          body: `A platform fee of ${amount.toFixed(4)} ${asset} has been collected from your account.`,
          read: false
        });
    } catch (err) {
      console.error('Failed to send fee collection notification:', err);
    }
  }

  /**
   * Get fee collection statistics
   */
  async getFeeCollectionStats(): Promise<{
    total_collected_usd: number;
    total_uncollected_usd: number;
    collection_count: number;
    last_collection: string | null;
  }> {
    try {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('metadata, created_at')
        .not('metadata->platform_fee_usd', 'is', null);

      if (!transactions) {
        return {
          total_collected_usd: 0,
          total_uncollected_usd: 0,
          collection_count: 0,
          last_collection: null
        };
      }

      let totalCollected = 0;
      let totalUncollected = 0;
      let collectionCount = 0;
      let lastCollection: string | null = null;

      for (const tx of transactions) {
        const feeAmount = parseFloat((tx.metadata as any)?.platform_fee_usd || '0');
        const isCollected = (tx.metadata as any)?.platformFeeCollected;

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
        total_uncollected_usd: Number(totalUncollected.toFixed(2)),
        collection_count: collectionCount,
        last_collection: lastCollection
      };
    } catch (err) {
      console.error('Error getting fee collection stats:', err);
      return {
        total_collected_usd: 0,
        total_uncollected_usd: 0,
        collection_count: 0,
        last_collection: null
      };
    }
  }
}

// Export singleton instance
export const feeCollectionBot = new FeeCollectionBot();