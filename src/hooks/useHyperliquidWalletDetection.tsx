import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWalletConnection } from './useWalletConnection';

interface TradingWallet {
  type: 'generated' | 'external' | null;
  address: string | null;
  balance: number;
  isReady: boolean;
}

export const useHyperliquidWalletDetection = () => {
  const { user } = useAuth();
  const { wallet } = useWalletConnection();
  const [tradingWallet, setTradingWallet] = useState<TradingWallet>({
    type: null,
    address: null,
    balance: 0,
    isReady: false
  });
  const [loading, setLoading] = useState(true);

  const checkHyperliquidBalance = useCallback(async (address: string): Promise<number> => {
    try {
      const { data, error } = await supabase.functions.invoke('hyperliquid-trading', {
        body: {
          operation: 'get_account',
          params: { address }
        }
      });

      if (error || !data) {
        return 0;
      }

      return parseFloat(data.marginSummary?.accountValue || '0');
    } catch (err) {
      console.error('[useHyperliquidWalletDetection] Balance check error:', err);
      return 0;
    }
  }, []);

  const detectTradingWallet = useCallback(async () => {
    if (!user?.id) {
      setTradingWallet({ type: null, address: null, balance: 0, isReady: false });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Check if user has generated wallet
      const { data: generatedWallet } = await supabase
        .from('hyperliquid_wallets')
        .select('address')
        .eq('user_id', user.id)
        .single();

      // 2. Check if external wallet is connected
      if (wallet.isConnected && wallet.address) {
        const externalBalance = await checkHyperliquidBalance(wallet.address);
        
        if (externalBalance > 0) {
          // External wallet has Hyperliquid funds - prioritize it
          setTradingWallet({
            type: 'external',
            address: wallet.address,
            balance: externalBalance,
            isReady: true
          });
          setLoading(false);
          return;
        }
      }

      // 3. Fall back to generated wallet
      if (generatedWallet?.address) {
        const generatedBalance = await checkHyperliquidBalance(generatedWallet.address);
        setTradingWallet({
          type: 'generated',
          address: generatedWallet.address,
          balance: generatedBalance,
          isReady: true
        });
        setLoading(false);
        return;
      }

      // 4. Check if external wallet exists but has no funds
      if (wallet.isConnected && wallet.address) {
        setTradingWallet({
          type: 'external',
          address: wallet.address,
          balance: 0,
          isReady: true
        });
        setLoading(false);
        return;
      }

      // 5. No trading wallet available
      setTradingWallet({ type: null, address: null, balance: 0, isReady: false });
    } catch (err) {
      console.error('[useHyperliquidWalletDetection] Detection error:', err);
      setTradingWallet({ type: null, address: null, balance: 0, isReady: false });
    } finally {
      setLoading(false);
    }
  }, [user?.id, wallet.isConnected, wallet.address, checkHyperliquidBalance]);

  useEffect(() => {
    detectTradingWallet();
  }, [detectTradingWallet]);

  return {
    tradingWallet,
    loading,
    refresh: detectTradingWallet
  };
};
