import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { blockchainService, WalletInfo } from '@/services/blockchainService';
import { realTimeBalanceService, RealTimeBalance } from '@/services/realTimeBalanceService';
import { useAuth } from './useAuth';

export const useBlockchainWallet = () => {
  const { user } = useAuth();
  const [walletInfo, setWalletInfo] = useState<WalletInfo[]>([]);
  const [balanceStatus, setBalanceStatus] = useState<RealTimeBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateWallet = useCallback(async () => {
    if (!user) {
      setError('User must be authenticated');
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      
      const address = await blockchainService.generateWalletAddress(user.id);
      await refreshWalletInfo();
      
      return address;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate wallet');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshWalletInfo = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Get wallet addresses for user
      const { data: addresses } = await supabase
        .from('onchain_addresses')
        .select('address, asset')
        .eq('user_id', user.id);

      if (!addresses) return;

      // Get balances for each address
      const walletData: WalletInfo[] = [];
      
      for (const addr of addresses) {
        if (addr.asset === 'USDC' || addr.asset === 'XAUT') {
          const balance = await blockchainService.getTokenBalance(addr.address, addr.asset);
          walletData.push({
            address: addr.address,
            balance,
            asset: addr.asset,
            chain: 'ethereum'
          });
        }
      }

      setWalletInfo(walletData);
      
      // Get balance sync status
      const status = await realTimeBalanceService.getUserBalanceStatus(user.id);
      setBalanceStatus(status);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh wallet info');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const forceSync = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      await realTimeBalanceService.forceSyncUser(user.id);
      await refreshWalletInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync balances');
    } finally {
      setLoading(false);
    }
  }, [user, refreshWalletInfo]);

  useEffect(() => {
    refreshWalletInfo();
  }, [refreshWalletInfo]);

  // Set up real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'balance_snapshots',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          refreshWalletInfo();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshWalletInfo]);

  return {
    walletInfo,
    balanceStatus,
    loading,
    error,
    generateWallet,
    refreshWalletInfo,
    forceSync
  };
};