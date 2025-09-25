import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { secureWalletService } from '@/services/secureWalletService';
import { supabase } from '@/integrations/supabase/client';

export interface WalletBalance {
  asset: string;
  amount: number;
  chain: string;
}

// Cache management
const BALANCE_CACHE_DURATION = 60 * 1000; // 1 minute
const balanceCache = new Map<string, { balances: WalletBalance[]; timestamp: number }>();

// Batch operation utility
class BatchBalanceManager {
  private static instance: BatchBalanceManager;
  private pendingRequests = new Map<string, Promise<WalletBalance[]>>();
  
  static getInstance() {
    if (!BatchBalanceManager.instance) {
      BatchBalanceManager.instance = new BatchBalanceManager();
    }
    return BatchBalanceManager.instance;
  }

  async getBalances(address: string): Promise<WalletBalance[]> {
    // Check if there's already a pending request for this address
    if (this.pendingRequests.has(address)) {
      return this.pendingRequests.get(address)!;
    }

    // Create new request
    const request = this.fetchBalancesInternal(address);
    this.pendingRequests.set(address, request);

    try {
      const result = await request;
      return result;
    } finally {
      this.pendingRequests.delete(address);
    }
  }

  private async fetchBalancesInternal(address: string): Promise<WalletBalance[]> {
    try {
      // Parallel blockchain calls for all assets
      const [usdcResult, xautResult, trzryResult] = await Promise.allSettled([
        supabase.functions.invoke('blockchain-operations', {
          body: {
            operation: 'get_balance',
            address: address,
            asset: 'USDC'
          }
        }),
        supabase.functions.invoke('blockchain-operations', {
          body: {
            operation: 'get_balance',
            address: address,
            asset: 'XAUT'
          }
        }),
        supabase.functions.invoke('blockchain-operations', {
          body: {
            operation: 'get_balance',
            address: address,
            asset: 'TRZRY'
          }
        })
      ]);

      const usdcBalance = usdcResult.status === 'fulfilled' && usdcResult.value.data?.success 
        ? usdcResult.value.data.balance : 0;
      const xautBalance = xautResult.status === 'fulfilled' && xautResult.value.data?.success 
        ? xautResult.value.data.balance : 0;
      const trzryBalance = trzryResult.status === 'fulfilled' && trzryResult.value.data?.success 
        ? trzryResult.value.data.balance : 0;

      return [
        { asset: 'USDC', amount: usdcBalance, chain: 'ethereum' },
        { asset: 'XAUT', amount: xautBalance, chain: 'ethereum' },
        { asset: 'TRZRY', amount: trzryBalance, chain: 'ethereum' }
      ];
    } catch (error) {
      console.error('Batch balance fetch failed:', error);
      return [
        { asset: 'USDC', amount: 0, chain: 'ethereum' },
        { asset: 'XAUT', amount: 0, chain: 'ethereum' },
        { asset: 'TRZRY', amount: 0, chain: 'ethereum' }
      ];
    }
  }
}

export function useOptimizedWalletBalance() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  
  const fetchTimeoutRef = useRef<NodeJS.Timeout>();
  const batchManager = useMemo(() => BatchBalanceManager.getInstance(), []);

  const getCacheKey = useCallback((address: string) => `balances_${address}`, []);

  const fetchBalances = useCallback(async (forceRefresh = false) => {
    if (!user?.id) {
      setBalances([]);
      return;
    }

    try {
      setLoading(true);
      
      // Get user's wallet address
      const address = await secureWalletService.getWalletAddress(user.id);
      if (!address) {
        console.log('No wallet address found for user');
        setBalances([]);
        return;
      }

      setWalletAddress(address);
      const cacheKey = getCacheKey(address);

      // Check cache first
      if (!forceRefresh) {
        const cached = balanceCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_DURATION) {
          setBalances(cached.balances);
          setLastFetch(cached.timestamp);
          return;
        }
      }

      // Use batch manager for optimized fetching
      const newBalances = await batchManager.getBalances(address);
      
      // Cache the results
      balanceCache.set(cacheKey, {
        balances: newBalances,
        timestamp: Date.now()
      });

      setBalances(newBalances);
      setLastFetch(Date.now());

    } catch (error) {
      console.error('Failed to fetch wallet balances:', error);
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, getCacheKey, batchManager]);

  // Background refresh function
  const scheduleBackgroundRefresh = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      if (Date.now() - lastFetch >= BALANCE_CACHE_DURATION) {
        fetchBalances(false); // Background refresh without forcing
      }
    }, BALANCE_CACHE_DURATION);
  }, [fetchBalances, lastFetch]);

  const refreshBalances = useCallback(() => {
    return fetchBalances(true);
  }, [fetchBalances]);

  const getBalance = useCallback((asset: string): number => {
    const balance = balances.find(b => b.asset === asset);
    return balance?.amount || 0;
  }, [balances]);

  // Memoized total value calculation
  const totalValue = useMemo(() => {
    return balances.reduce((total, balance) => {
      if (balance.asset === 'USDC') return total + balance.amount;
      if (balance.asset === 'XAUT') return total + (balance.amount * 2000); // Rough gold price
      return total;
    }, 0);
  }, [balances]);

  // Initial fetch
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Set up background refresh
  useEffect(() => {
    if (balances.length > 0) {
      scheduleBackgroundRefresh();
    }

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [balances.length, scheduleBackgroundRefresh]);

  // Real-time updates via Supabase
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('balance-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'balance_snapshots',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Refresh balances when new snapshot is inserted
          fetchBalances(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchBalances]);

  // Performance monitoring
  const performanceMetrics = useMemo(() => ({
    lastFetchTime: lastFetch,
    cacheHitRate: balanceCache.size > 0 ? 1 : 0, // Simplified
    loadingTime: loading ? Date.now() - lastFetch : 0
  }), [lastFetch, loading]);

  return {
    balances,
    totalValue,
    loading,
    isConnected: !!walletAddress,
    walletAddress,
    refreshBalances,
    fetchBalances,
    getBalance,
    performanceMetrics
  };
}