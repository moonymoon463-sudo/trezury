import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { secureWalletService } from '@/services/secureWalletService';
import { walletBalancesService, WalletBalance } from '@/services/walletBalancesService';
import { supabase } from '@/integrations/supabase/client';

export function useWalletBalances() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const fetchBalances = useCallback(async (forceRefresh = false, silent = false) => {
    if (!user?.id) {
      setBalances([]);
      setWalletAddress(null);
      return;
    }

    try {
      if (!silent) setLoading(true);
      setError(null);

      // Get wallet address
      const address = await secureWalletService.getWalletAddress(user.id);
      if (!address) {
        console.log('No wallet address found');
        setBalances([]);
        setWalletAddress(null);
        return;
      }

      setWalletAddress(address);

      // Fetch balances with retry and fallback logic
      const result = await walletBalancesService.fetchBalances(address, forceRefresh);
      
      setBalances(result.balances);
      setFromCache(result.fromCache);
      
      if (result.fromCache && !silent) {
        console.log('📦 Showing cached balances, refreshing in background...');
      }
    } catch (err) {
      console.error('Failed to fetch wallet balances:', err);
      setError('Failed to load balances');
      
      // Keep showing old balances if available
      if (balances.length === 0) {
        setBalances([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.id, balances.length]);

  const refreshBalances = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    return fetchBalances(true, false);
  }, [fetchBalances]);

  const getBalance = useCallback((asset: 'ETH' | 'USDC' | 'XAUT' | 'TRZRY'): number => {
    const balance = balances.find(b => b.asset === asset);
    return balance?.amount || 0;
  }, [balances]);

  const totalValueUSD = useMemo(() => {
    // Simple USD value estimation (you can enhance this with real prices)
    let total = 0;
    
    for (const balance of balances) {
      if (balance.asset === 'USDC') {
        total += balance.amount;
      } else if (balance.asset === 'XAUT') {
        // Approximate gold price at $2000/oz
        total += balance.amount * 2000;
      } else if (balance.asset === 'ETH') {
        // Approximate ETH price at $2000
        total += balance.amount * 2000;
      }
      // TRZRY value TBD
    }
    
    return total;
  }, [balances]);

  // Initial fetch
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Subscribe to transaction status changes for auto-refresh
  useEffect(() => {
    if (!user?.id) return;

    let lastRefresh = Date.now();
    const MIN_REFRESH_INTERVAL = 60000; // Max 1 refresh per minute

    const channel = supabase
      .channel('transaction-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as any).status;
          
          // Refresh balances when transaction settles
          if (newStatus === 'completed' || newStatus === 'failed') {
            const now = Date.now();
            if (now - lastRefresh > MIN_REFRESH_INTERVAL) {
              console.log(`🔄 Auto-refreshing balances (transaction ${newStatus})`);
              lastRefresh = now;
              fetchBalances(true, true); // Silent refresh
            } else {
              console.log('⏸️ Skipping auto-refresh (debounced)');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchBalances]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      walletBalancesService.cancelAllRequests();
    };
  }, []);

  return {
    balances,
    loading,
    error,
    walletAddress,
    isConnected: !!walletAddress,
    refreshBalances,
    getBalance,
    totalValueUSD,
    fromCache,
  };
}
