import { supabase } from "@/integrations/supabase/client";

interface WalletActivity {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  blockNumber: number;
  timestamp: number;
  gasUsed?: string;
  gasPrice?: string;
}

class BlockchainMonitoringService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  async startMonitoring(userWalletAddresses: string[]) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;

    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.checkForNewActivity(userWalletAddresses);
    }, 30000);

    // Initial check
    await this.checkForNewActivity(userWalletAddresses);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
  }

  destroy() {
    this.stopMonitoring();
  }

  private async checkForNewActivity(walletAddresses: string[]) {
    try {
      for (const address of walletAddresses) {
        await this.checkAddressActivity(address);
      }
    } catch (error) {
      // Silent failure
    }
  }

  private async checkAddressActivity(address: string) {
    try {
      // Call blockchain operations edge function to get recent transactions
      const { data: activity, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'get_transaction_history',
          address,
          limit: 10
        }
      });

      if (error) return;

      if (activity?.transactions) {
        await this.processNewTransactions(address, activity.transactions);
      }
    } catch (error) {
      // Silent failure
    }
  }

  private async processNewTransactions(userAddress: string, transactions: WalletActivity[]) {
    for (const tx of transactions) {
      // Check if we've already recorded this transaction
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('tx_hash', tx.hash)
        .maybeSingle();

      if (existingTx) continue; // Already recorded

      // Determine transaction type and details
      const isReceive = tx.to.toLowerCase() === userAddress.toLowerCase();
      const isSend = tx.from.toLowerCase() === userAddress.toLowerCase();

      if (!isReceive && !isSend) continue; // Not related to this user

      const type = isReceive ? 'receive' : 'send';
      const quantity = parseFloat(tx.value);

      // Get user ID from wallet address
      const { data: wallet } = await supabase
        .from('wallets')
        .select('user_id')
        .eq('address', userAddress)
        .maybeSingle();

      if (!wallet) continue;

      // Record the transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: wallet.user_id,
          type,
          asset: tx.asset,
          quantity,
          status: 'completed',
          tx_hash: tx.hash,
          metadata: {
            from_address: tx.from,
            to_address: tx.to,
            block_number: tx.blockNumber,
            gas_used: tx.gasUsed,
            gas_price: tx.gasPrice,
            transaction_source: 'external_wallet',
            detected_via: 'blockchain_monitoring',
            timestamp: tx.timestamp
          }
        });

      // Update balance snapshot
      await supabase
        .from('balance_snapshots')
        .insert({
          user_id: wallet.user_id,
          asset: tx.asset,
          amount: isReceive ? quantity : -quantity,
          snapshot_at: new Date(tx.timestamp * 1000).toISOString()
        });
    }
  }

  async getUserWalletAddresses(userId: string): Promise<string[]> {
    try {
      const { data: wallets } = await supabase
        .from('wallets')
        .select('address')
        .eq('user_id', userId);

      const { data: onchainAddresses } = await supabase
        .from('onchain_addresses')
        .select('address')
        .eq('user_id', userId);

      const addresses = [
        ...(wallets || []).map(w => w.address),
        ...(onchainAddresses || []).map(a => a.address)
      ];

      return [...new Set(addresses)]; // Remove duplicates
    } catch (error) {
      return [];
    }
  }
}

export const blockchainMonitoringService = new BlockchainMonitoringService();