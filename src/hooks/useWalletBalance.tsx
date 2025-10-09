import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { secureWalletService } from '@/services/secureWalletService';
import { supabase } from '@/integrations/supabase/client';

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
      
      // Get user's unique wallet address with retry
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
        setBalances([]);
        setLoading(false);
        return;
      }

      setWalletAddress(address);

      // Fetch all balances in parallel with retry logic
      const fetchWithRetry = async (asset: string, attempts = 3): Promise<number> => {
        for (let i = 0; i < attempts; i++) {
          try {
            const { data, error } = await supabase.functions.invoke('blockchain-operations', {
              body: {
                operation: 'get_balance',
                address: address,
                asset: asset
              }
            });
            
            if (error) throw error;
            if (data?.success) return data.balance || 0;
          } catch (err) {
            console.warn(`Attempt ${i + 1}/${attempts} failed for ${asset}:`, err);
            if (i < attempts - 1) {
              await new Promise(r => setTimeout(r, 300 * Math.pow(2, i)));
            }
          }
        }
        return 0;
      };

      const [usdcBalance, xautBalance, trzryBalance, ethBalance] = await Promise.all([
        fetchWithRetry('USDC'),
        fetchWithRetry('XAUT'),
        fetchWithRetry('TRZRY'),
        fetchWithRetry('ETH')
      ]);

      const newBalances: WalletBalance[] = [
        { asset: 'ETH', amount: ethBalance, chain: 'ethereum' },
        { asset: 'USDC', amount: usdcBalance, chain: 'ethereum' },
        { asset: 'XAUT', amount: xautBalance, chain: 'ethereum' },
        { asset: 'TRZRY', amount: trzryBalance, chain: 'ethereum' }
      ];

      console.log('💰 Setting balances:', newBalances);
      setBalances(newBalances);
    } catch (error) {
      console.error('Failed to fetch wallet balances:', error);
      // Don't clear balances on error, keep last known values
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
    if (user?.id) {
      fetchBalances();
    }
  }, [user?.id]);

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