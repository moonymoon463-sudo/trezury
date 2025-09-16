import { supabase } from "@/integrations/supabase/client";
import { blockchainService } from "./blockchainService";

export interface RealTimeBalance {
  asset: 'USDC' | 'XAUT';
  database_balance: number;
  blockchain_balance: number;
  is_synced: boolean;
  last_sync: string;
}

class RealTimeBalanceService {
  private readonly SYNC_INTERVAL_MS = 60000; // 1 minute
  private syncInterval: number | null = null;
  private isRunning = false;

  /**
   * Start real-time balance synchronization
   */
  start(): void {
    if (this.isRunning) {
      console.log('Balance sync is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting real-time balance synchronization...');
    
    // Run immediately, then on interval
    this.syncAllUserBalances();
    
    this.syncInterval = window.setInterval(() => {
      this.syncAllUserBalances();
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Stop real-time balance synchronization
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('Balance synchronization stopped');
  }

  /**
   * Sync balances for all users
   */
  private async syncAllUserBalances(): Promise<void> {
    try {
      // Get all user addresses
      const { data: addresses, error } = await supabase
        .from('onchain_addresses')
        .select('user_id, address, asset')
        .order('created_at', { ascending: false });

      if (error || !addresses) {
        console.error('Failed to fetch user addresses:', error);
        return;
      }

      // Group addresses by user
      const userAddresses = new Map<string, { usdc: string | null, xaut: string | null }>();
      
      for (const addr of addresses) {
        if (!userAddresses.has(addr.user_id)) {
          userAddresses.set(addr.user_id, { usdc: null, xaut: null });
        }
        
        const userAddr = userAddresses.get(addr.user_id)!;
        if (addr.asset === 'USDC') {
          userAddr.usdc = addr.address;
        } else if (addr.asset === 'XAUT') {
          userAddr.xaut = addr.address;
        }
      }

      // Sync balances for each user
      for (const [userId, userAddr] of userAddresses.entries()) {
        if (userAddr.usdc) {
          await this.syncUserBalance(userId, userAddr.usdc, 'USDC');
        }
        if (userAddr.xaut) {
          await this.syncUserBalance(userId, userAddr.xaut, 'XAUT');
        }
      }
      
      console.log(`Synced balances for ${userAddresses.size} users`);
    } catch (err) {
      console.error('Error in balance synchronization:', err);
    }
  }

  /**
   * Sync balance for a specific user and asset
   */
  private async syncUserBalance(userId: string, address: string, asset: 'USDC' | 'XAUT'): Promise<void> {
    try {
      // Get blockchain balance
      const blockchainBalance = await blockchainService.getTokenBalance(address, asset);
      
      // Get database balance (sum of all snapshots)
      const { data: snapshots } = await supabase
        .from('balance_snapshots')
        .select('amount')
        .eq('user_id', userId)
        .eq('asset', asset);

      const databaseBalance = snapshots?.reduce((sum, snapshot) => sum + Number(snapshot.amount), 0) || 0;

      // Check if balances are synced (allow small differences due to gas fees)
      const tolerance = 0.0001; // 0.0001 token tolerance
      const isSynced = Math.abs(blockchainBalance - databaseBalance) <= tolerance;

      if (!isSynced) {
        console.warn(`Balance mismatch for user ${userId} ${asset}: DB=${databaseBalance}, Blockchain=${blockchainBalance}`);
        
        // Create adjustment snapshot to sync balances
        const adjustment = blockchainBalance - databaseBalance;
        await supabase
          .from('balance_snapshots')
          .insert({
            user_id: userId,
            asset,
            amount: adjustment,
            snapshot_at: new Date().toISOString()
          });

        console.log(`Adjusted balance for user ${userId} ${asset}: ${adjustment}`);
      }
    } catch (err) {
      console.error(`Failed to sync balance for user ${userId} ${asset}:`, err);
    }
  }

  /**
   * Get real-time balance comparison for a user
   */
  async getUserBalanceStatus(userId: string): Promise<RealTimeBalance[]> {
    try {
      const { data: addresses } = await supabase
        .from('onchain_addresses')
        .select('address, asset')
        .eq('user_id', userId);

      if (!addresses) return [];

      const balances: RealTimeBalance[] = [];

      for (const addr of addresses) {
        if (addr.asset === 'USDC' || addr.asset === 'XAUT') {
          const blockchainBalance = await blockchainService.getTokenBalance(addr.address, addr.asset);
          
          const { data: snapshots } = await supabase
            .from('balance_snapshots')
            .select('amount')
            .eq('user_id', userId)
            .eq('asset', addr.asset);

          const databaseBalance = snapshots?.reduce((sum, snapshot) => sum + Number(snapshot.amount), 0) || 0;
          
          const tolerance = 0.0001;
          const isSynced = Math.abs(blockchainBalance - databaseBalance) <= tolerance;

          balances.push({
            asset: addr.asset,
            database_balance: databaseBalance,
            blockchain_balance: blockchainBalance,
            is_synced: isSynced,
            last_sync: new Date().toISOString()
          });
        }
      }

      return balances;
    } catch (err) {
      console.error('Failed to get user balance status:', err);
      return [];
    }
  }

  /**
   * Force sync for a specific user
   */
  async forceSyncUser(userId: string): Promise<void> {
    try {
      const { data: addresses } = await supabase
        .from('onchain_addresses')
        .select('address, asset')
        .eq('user_id', userId);

      if (!addresses) return;

      for (const addr of addresses) {
        if (addr.asset === 'USDC' || addr.asset === 'XAUT') {
          await this.syncUserBalance(userId, addr.address, addr.asset);
        }
      }
    } catch (err) {
      console.error('Failed to force sync user:', err);
    }
  }
}

export const realTimeBalanceService = new RealTimeBalanceService();