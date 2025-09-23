import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { secureWalletService } from '@/services/secureWalletService';
import { blockchainService } from '@/services/blockchainService';

export interface WalletBalance {
  asset: string;
  amount: number;
  chain: string;
}

export function useWalletBalance() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!user?.id) {
      setBalances([]);
      return;
    }

    try {
      setLoading(true);
      
      // Get user's unique wallet address
      const address = await secureWalletService.getWalletAddress(user.id);
      if (!address) {
        console.log('No wallet address found for user');
        setBalances([]);
        return;
      }

      setWalletAddress(address);

      // Fetch balances for USDC and XAUT
      const [usdcBalance, xautBalance] = await Promise.all([
        blockchainService.getTokenBalance(address, 'USDC').catch(() => 0),
        blockchainService.getTokenBalance(address, 'XAUT').catch(() => 0)
      ]);

      const newBalances: WalletBalance[] = [
        {
          asset: 'USDC',
          amount: usdcBalance,
          chain: 'ethereum'
        },
        {
          asset: 'XAUT',
          amount: xautBalance,
          chain: 'ethereum'
        }
      ];

      setBalances(newBalances);
    } catch (error) {
      console.error('Failed to fetch wallet balances:', error);
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const refreshBalances = useCallback(() => {
    return fetchBalances();
  }, [fetchBalances]);

  const getBalance = useCallback((asset: string): number => {
    const balance = balances.find(b => b.asset === asset);
    return balance?.amount || 0;
  }, [balances]);

  const totalValue = balances.reduce((total, balance) => {
    // Simplified USD value calculation
    if (balance.asset === 'USDC') return total + balance.amount;
    if (balance.asset === 'XAUT') return total + (balance.amount * 2000); // Rough gold price
    return total;
  }, 0);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return {
    balances,
    totalValue,
    loading,
    isConnected: !!walletAddress,
    walletAddress,
    refreshBalances,
    fetchBalances,
    getBalance,
  };
}