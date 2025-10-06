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
      
      // Get user's unique wallet address
      const address = await secureWalletService.getWalletAddress(user.id);
      if (!address) {
        console.log('No wallet address found for user');
        setBalances([]);
        return;
      }

      setWalletAddress(address);

      // Fetch live balances from blockchain via edge function
      const { data: usdcResult, error: usdcError } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'get_balance',
          address: address,
          asset: 'USDC'
        }
      });

      const { data: xautResult, error: xautError } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'get_balance', 
          address: address,
          asset: 'XAUT'
        }
      });

      const { data: trzryResult, error: trzryError } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'get_balance', 
          address: address,
          asset: 'TRZRY'
        }
      });
      
      // Log any errors for debugging
      if (usdcError) console.error('USDC balance fetch error:', usdcError);
      if (xautError) console.error('XAUT balance fetch error:', xautError);
      if (trzryError) console.error('TRZRY balance fetch error:', trzryError);
      
      const usdcBalance = usdcResult?.success ? usdcResult.balance : 0;
      const xautBalance = xautResult?.success ? xautResult.balance : 0;
      const trzryBalance = trzryResult?.success ? trzryResult.balance : 0;

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
        },
        {
          asset: 'TRZRY',
          amount: trzryBalance,
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