import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { secureWalletService } from '@/services/secureWalletService';
import { walletBalancesService, WalletBalances } from '@/services/walletBalancesService';
import { supabase } from '@/integrations/supabase/client';

export function useWalletBalances() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  
  // Request ID for race condition prevention
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch balances with race condition guard
   */
  const fetchBalances = useCallback(async (forceRefresh = false, silent = false) => {
    if (!user?.id) {
      setBalances(null);
      setWalletAddress(null);
      return;
    }

    // Increment request ID
    const currentRequestId = ++requestIdRef.current;
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      // Get wallet address
      const address = await secureWalletService.getWalletAddress(user.id);
      if (!address) {
        console.log('No wallet address found');
        setBalances(null);
        setWalletAddress(null);
        return;
      }

      // Check if this request is still valid
      if (currentRequestId !== requestIdRef.current) {
        console.log('Request cancelled (newer request started)');
        return;
      }

      setWalletAddress(address);

      // Fetch balances
      const result = await walletBalancesService.getAllBalances(address, forceRefresh);

      // Check again before updating state
      if (currentRequestId !== requestIdRef.current) {
        console.log('Request cancelled (newer request started)');
        return;
      }

      console.log('💰 Balances fetched:', result);
      setBalances(result);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      // Only update error if this is still the current request
      if (currentRequestId === requestIdRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balances';
        console.error('Balance fetch error:', errorMessage);
        setError(errorMessage);
      }
    } finally {
      if (currentRequestId === requestIdRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  /**
   * Manual refresh (force)
   */
  const refreshBalances = useCallback(() => {
    return fetchBalances(true, false);
  }, [fetchBalances]);

  /**
   * Background refresh (silent)
   */
  const silentRefresh = useCallback(() => {
    return fetchBalances(true, true);
  }, [fetchBalances]);

  /**
   * Get balance for a specific token
   */
  const getBalance = useCallback((symbol: string): string => {
    if (!balances) return '0';
    
    if (symbol === 'ETH') {
      return balances.eth.balance;
    }
    
    const token = balances.tokens.find(t => t.symbol === symbol);
    return token?.balance || '0';
  }, [balances]);

  /**
   * Get formatted balance for display
   */
  const getFormattedBalance = useCallback((symbol: string): string => {
    const balance = getBalance(symbol);
    const token = symbol === 'ETH' 
      ? balances?.eth 
      : balances?.tokens.find(t => t.symbol === symbol);
    
    if (!token) return '0';
    
    return walletBalancesService.formatBalance(balance, token.decimals);
  }, [balances, getBalance]);

  // Initial fetch on mount
  useEffect(() => {
    fetchBalances(false, false);
  }, [fetchBalances]);

  // Listen for transaction updates via Supabase Realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`transactions-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 Transaction update detected:', payload);
          const transaction = payload.new as any;
          
          // Auto-refresh on status changes
          if (transaction?.status === 'completed' || 
              transaction?.status === 'failed' ||
              transaction?.status === 'broadcasted') {
            console.log('💰 Auto-refreshing balances after transaction status change');
            silentRefresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, silentRefresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
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
    getFormattedBalance,
    eth: balances?.eth,
    tokens: balances?.tokens || [],
  };
}
