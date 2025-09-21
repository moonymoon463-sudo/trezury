import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useSecureWallet } from './useSecureWallet';
import { blockchainTestnetService } from '@/services/blockchainTestnetService';

export interface WalletBalance {
  asset: string;
  amount: number;
  chain: string;
}

export const useWalletBalance = () => {
  const { user } = useAuth();
  const { walletAddress, getWalletAddress } = useSecureWallet();
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

      // Get wallet address first
      let address = walletAddress;
      if (!address) {
        address = await getWalletAddress();
      }

      if (address) {
        console.log('🔍 Fetching real testnet balances for:', address);
        
        // Fetch real blockchain balances from Sepolia testnet
        const realBalances = await blockchainTestnetService.getMultipleBalances(
          address, 
          ['ETH', 'USDC', 'DAI']
        );

        const walletBalances: WalletBalance[] = Object.entries(realBalances).map(([asset, amount]) => ({
          asset: asset === 'DAI' ? 'GOLD' : asset, // Map DAI to GOLD for demo
          amount,
          chain: 'sepolia' // Using Sepolia testnet
        }));

        console.log('✅ Real testnet balances loaded:', walletBalances);
        setBalances(walletBalances);
      } else {
        // Fallback to database snapshots if no wallet
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
          asset: asset === 'XAUT' ? 'GOLD' : asset, // Display XAUT as GOLD
          amount,
          chain: 'ethereum'
        }));

        setBalances(walletBalances);
        console.log('✅ Database balances loaded:', walletBalances);
      }
    } catch (err) {
      console.error('Failed to fetch wallet balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
      
      // Fallback to demo data
      setBalances([
        { asset: 'ETH', amount: 0.1, chain: 'sepolia' },
        { asset: 'USDC', amount: 100.0, chain: 'sepolia' },
        { asset: 'GOLD', amount: 0.05, chain: 'sepolia' }
      ]);
    } finally {
      setLoading(false);
    }
  }, [user, walletAddress, getWalletAddress]);

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