import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { secureWalletService } from '@/services/secureWalletService';
import { supabase } from '@/integrations/supabase/client';
import { useCryptoPrices } from './useCryptoPrices';
import { useGoldPrice } from './useGoldPrice';

export interface WalletBalance {
  asset: string;
  amount: number;
  chain: string;
}

// Cache management with mobile optimization
import { useIsMobile } from './use-mobile';
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
      // Single optimized call to get all balances at once
      const { data: batchResult, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'get_all_balances',
          address: address
        }
      });

      if (error) throw error;

      if (batchResult?.success && batchResult?.balances) {
        // Map balances directly from backend response preserving chain info
        return batchResult.balances.map((b: any) => ({
          asset: b.asset,  // Keep original asset identifier (USDC_ARB, XAUT_ARB, etc.)
          amount: b.balance || 0,
          chain: b.chain
        }));
      }

      // Fallback to individual calls if batch fails
      console.warn('Batch balance fetch failed, falling back to individual calls');
      const [usdcResult, xautResult, trzryResult, usdcArbResult, xautArbResult] = await Promise.allSettled([
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
        }),
        supabase.functions.invoke('blockchain-operations', {
          body: {
            operation: 'get_balance',
            address: address,
            asset: 'USDC_ARB'
          }
        }),
        supabase.functions.invoke('blockchain-operations', {
          body: {
            operation: 'get_balance',
            address: address,
            asset: 'XAUT_ARB'
          }
        })
      ]);

      const usdcBalance = usdcResult.status === 'fulfilled' && usdcResult.value.data?.success 
        ? usdcResult.value.data.balance : 0;
      const xautBalance = xautResult.status === 'fulfilled' && xautResult.value.data?.success 
        ? xautResult.value.data.balance : 0;
      const trzryBalance = trzryResult.status === 'fulfilled' && trzryResult.value.data?.success 
        ? trzryResult.value.data.balance : 0;
      const usdcArbBalance = usdcArbResult.status === 'fulfilled' && usdcArbResult.value.data?.success 
        ? usdcArbResult.value.data.balance : 0;
      const xautArbBalance = xautArbResult.status === 'fulfilled' && xautArbResult.value.data?.success 
        ? xautArbResult.value.data.balance : 0;

      return [
        { asset: 'USDC', amount: usdcBalance, chain: 'ethereum' },
        { asset: 'XAUT', amount: xautBalance, chain: 'ethereum' },
        { asset: 'TRZRY', amount: trzryBalance, chain: 'ethereum' },
        { asset: 'USDC_ARB', amount: usdcArbBalance, chain: 'arbitrum' },
        { asset: 'XAUT_ARB', amount: xautArbBalance, chain: 'arbitrum' }
      ];
    } catch (error) {
      console.error('Batch balance fetch failed:', error);
      return [
        { asset: 'USDC', amount: 0, chain: 'ethereum' },
        { asset: 'XAUT', amount: 0, chain: 'ethereum' },
        { asset: 'TRZRY', amount: 0, chain: 'ethereum' },
        { asset: 'USDC_ARB', amount: 0, chain: 'arbitrum' },
        { asset: 'XAUT_ARB', amount: 0, chain: 'arbitrum' }
      ];
    }
  }
}

export function useOptimizedWalletBalance() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { prices: cryptoPrices } = useCryptoPrices();
  const { price: goldPrice } = useGoldPrice();
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  
  // Mobile-optimized cache duration
  const BALANCE_CACHE_DURATION = isMobile ? 5 * 60 * 1000 : 30 * 1000; // 5 min mobile, 30s desktop
  
  const fetchTimeoutRef = useRef<NodeJS.Timeout>();
  const batchManager = useMemo(() => BatchBalanceManager.getInstance(), []);

  const getCacheKey = useCallback((address: string) => `balances_${address}`, []);

  const fetchBalances = useCallback(async (forceRefresh = false, silent = false) => {
    if (!user?.id) {
      setBalances([]);
      return;
    }

    try {
      // Only show loading on initial load or explicit refresh, not background updates
      if (!silent) {
        setLoading(true);
      }
      
      // Get user's wallet address with retry
      let address = null;
      let retries = 3;
      while (!address && retries > 0) {
        address = await secureWalletService.getWalletAddress(user.id);
        if (!address) {
          retries--;
          if (retries > 0) await new Promise(r => setTimeout(r, 500));
        }
      }
      
      if (!address) {
        console.log('No wallet address found for user after retries');
        if (!silent) setLoading(false);
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
          if (!silent) setLoading(false);
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
      // Don't clear balances on error, keep last known values
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [user?.id, getCacheKey, batchManager, BALANCE_CACHE_DURATION]);

  // Background refresh function - silent on mobile
  const scheduleBackgroundRefresh = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      if (Date.now() - lastFetch >= BALANCE_CACHE_DURATION) {
        fetchBalances(false, isMobile); // Silent refresh on mobile
      }
    }, BALANCE_CACHE_DURATION);
  }, [fetchBalances, lastFetch, BALANCE_CACHE_DURATION, isMobile]);

  const refreshBalances = useCallback(() => {
    return fetchBalances(true);
  }, [fetchBalances]);

  const getBalance = useCallback((asset: string, chain?: string): number => {
    if (chain) {
      const balance = balances.find(b => b.asset === asset && b.chain === chain);
      return balance?.amount || 0;
    }
    const balance = balances.find(b => b.asset === asset);
    return balance?.amount || 0;
  }, [balances]);

  const getAggregatedBalance = useCallback((baseAsset: string): number => {
    // Handle _ARB suffix variants
    const variants = [baseAsset, `${baseAsset}_ARB`];
    
    const total = balances
      .filter(b => variants.includes(b.asset))
      .reduce((sum, b) => sum + b.amount, 0);
    return total;
  }, [balances]);

  // Memoized total value calculation with real-time prices
  const totalValue = useMemo(() => {
    return balances.reduce((total, balance) => {
      if (balance.asset === 'USDC') return total + balance.amount;
      if (balance.asset === 'XAUT') return total + (balance.amount * (goldPrice?.usd_per_oz || 3981));
      if (balance.asset === 'TRZRY') return total + balance.amount;
      return total;
    }, 0);
  }, [balances, cryptoPrices, goldPrice]);

  // Initial fetch
  useEffect(() => {
    if (user?.id) {
      fetchBalances();
    }
  }, [user?.id, fetchBalances]);

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

  // Real-time updates via Supabase with cooldown
  useEffect(() => {
    if (!user?.id) return;

    let lastRealTimeUpdate = 0;
    const REALTIME_COOLDOWN = isMobile ? 5 * 60 * 1000 : 60 * 1000; // 5 min mobile, 1 min desktop

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
          const now = Date.now();
          // Apply cooldown to prevent spam refreshes
          if (now - lastRealTimeUpdate >= REALTIME_COOLDOWN) {
            lastRealTimeUpdate = now;
            // Silent refresh on mobile to prevent UI flicker
            fetchBalances(true, isMobile);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchBalances, isMobile]);

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
    getAggregatedBalance,
    performanceMetrics
  };
}