import { useState, useEffect, useCallback } from 'react';
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

export function useWalletBalance() {
  const { user } = useAuth();
  const { prices: cryptoPrices } = useCryptoPrices();
  const { price: goldPrice } = useGoldPrice();
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

      // Map the response to our balance format - now includes both chains
      interface BalanceResponse { balance: number; chain: string; asset: string }
      const balancesMap = new Map<string, BalanceResponse>(
        allBalancesData.balances?.map((b: any) => [b.asset, b as BalanceResponse]) || []
      );

      const newBalances: WalletBalance[] = [
        { asset: 'ETH', amount: Number(balancesMap.get('ETH')?.balance || 0), chain: 'ethereum' },
        { asset: 'USDC', amount: Number(balancesMap.get('USDC')?.balance || 0), chain: 'ethereum' },
        { asset: 'XAUT', amount: Number(balancesMap.get('XAUT')?.balance || 0), chain: 'ethereum' },
        { asset: 'TRZRY', amount: Number(balancesMap.get('TRZRY')?.balance || 0), chain: 'ethereum' },
        { asset: 'USDC', amount: Number(balancesMap.get('USDC_ARB')?.balance || 0), chain: 'arbitrum' },
        { asset: 'XAUT', amount: Number(balancesMap.get('XAUT_ARB')?.balance || 0), chain: 'arbitrum' }
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

  const getAggregatedBalance = useCallback((asset: string): number => {
    // Sum balances across all chains for the same asset
    const total = balances
      .filter(b => b.asset === asset)
      .reduce((sum, b) => sum + b.amount, 0);
    return total;
  }, [balances]);

  const totalValue = balances.reduce((total, balance) => {
    if (balance.asset === 'USDC') return total + balance.amount;
    if (balance.asset === 'XAUT') return total + (balance.amount * (goldPrice?.usd_per_oz || 3981));
    if (balance.asset === 'ETH') return total + (balance.amount * (cryptoPrices?.ETH || 0));
    if (balance.asset === 'BTC') return total + (balance.amount * (cryptoPrices?.BTC || 0));
    if (balance.asset === 'TRZRY') return total + balance.amount; // 1:1 with USD
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
    getAggregatedBalance,
  };
}