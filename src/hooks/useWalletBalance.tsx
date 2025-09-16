import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface WalletBalance {
  asset: string;
  amount: number;
  chain: string;
}

export const useWalletBalance = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!user) {
      setBalances([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch latest balance snapshots for the user
      const { data, error: fetchError } = await supabase
        .from('balance_snapshots')
        .select('asset, amount')
        .eq('user_id', user.id)
        .order('snapshot_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Group by asset and get latest balance for each
      const balanceMap = new Map<string, number>();
      data?.forEach(snapshot => {
        if (!balanceMap.has(snapshot.asset)) {
          balanceMap.set(snapshot.asset, Number(snapshot.amount));
        }
      });

      const walletBalances: WalletBalance[] = Array.from(balanceMap.entries()).map(([asset, amount]) => ({
        asset,
        amount,
        chain: 'ethereum' // Both USDC and GOLD on Ethereum
      }));

      // Add mock data if no balances exist
      if (walletBalances.length === 0) {
        walletBalances.push(
          { asset: 'USDC', amount: 1000.00, chain: 'ethereum' },
          { asset: 'GOLD', amount: 2.5, chain: 'ethereum' }
        );
      }

      setBalances(walletBalances);
    } catch (err) {
      console.error('Failed to fetch wallet balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
      
      // Fallback to mock data
      setBalances([
        { asset: 'USDC', amount: 1000.00, chain: 'ethereum' },
        { asset: 'GOLD', amount: 2.5, chain: 'ethereum' }
      ]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Set up real-time balance updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('balance-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'balance_snapshots',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchBalances();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchBalances]);

  const getBalance = useCallback((asset: string): number => {
    const balance = balances.find(b => b.asset === asset);
    return balance?.amount || 0;
  }, [balances]);

  return {
    balances,
    loading,
    error,
    fetchBalances,
    getBalance
  };
};