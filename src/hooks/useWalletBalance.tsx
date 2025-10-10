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

      // Fetch all balances in one call with retry logic
      let allBalancesData = null;
      retries = 3;
      for (let i = 0; i < retries; i++) {
        try {
          const { data, error } = await supabase.functions.invoke('blockchain-operations', {
            body: { 
              operation: 'get_all_balances', 
              address
            }
          });

          if (error) throw error;
          
          if (!data?.success) {
            throw new Error('Failed to fetch balances');
          }

          allBalancesData = data;
          break; // Success, exit retry loop
        } catch (err) {
          console.warn(`Retry ${i + 1}/${retries} failed:`, err);
          if (i === retries - 1) throw err;
          await new Promise(resolve => setTimeout(resolve, 300 * Math.pow(2, i))); // Exponential backoff
        }
      }

      if (!allBalancesData) {
        console.error('Failed to fetch balances after retries');
        setBalances([]);
        setLoading(false);
        return;
      }

      // Map the response to our balance format
      const balancesMap = new Map(
        allBalancesData.balances?.map((b: any) => [b.asset, b.balance]) || []
      );

      const newBalances: WalletBalance[] = [
        { asset: 'ETH', amount: Number(balancesMap.get('ETH') || 0), chain: 'ethereum' },
        { asset: 'USDC', amount: Number(balancesMap.get('USDC') || 0), chain: 'ethereum' },
        { asset: 'XAUT', amount: Number(balancesMap.get('XAUT') || 0), chain: 'ethereum' },
        { asset: 'TRZRY', amount: Number(balancesMap.get('TRZRY') || 0), chain: 'ethereum' }
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
    if (balance.asset === 'ETH') return total + (balance.amount * 2500); // Rough ETH price
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