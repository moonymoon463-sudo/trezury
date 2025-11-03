import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { HyperliquidAccountState } from '@/types/hyperliquid';

export const useHyperliquidAccount = (address?: string, autoRefresh: boolean = true) => {
  const [accountInfo, setAccountInfo] = useState<HyperliquidAccountState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    if (!address) {
      setAccountInfo(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { data, error: funcError } = await supabase.functions.invoke('hyperliquid-trading', {
        body: {
          operation: 'get_account',
          params: { address }
        }
      });

      if (funcError) {
        console.warn('[useHyperliquidAccount] API error:', funcError);
        // Don't throw - set empty account state instead for new wallets
        setAccountInfo({
          marginSummary: {
            accountValue: '0',
            totalMarginUsed: '0',
            totalNtlPos: '0',
            totalRawUsd: '0',
          },
          crossMarginSummary: {
            accountValue: '0',
            totalMarginUsed: '0',
            totalNtlPos: '0',
            totalRawUsd: '0',
          },
          withdrawable: '0',
          assetPositions: []
        });
        return;
      }
      
      setAccountInfo(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load account';
      setError(errorMsg);
      console.error('[useHyperliquidAccount] Error:', err);
      
      // Set empty account state instead of null for new wallets
      setAccountInfo({
        marginSummary: {
          accountValue: '0',
          totalMarginUsed: '0',
          totalNtlPos: '0',
          totalRawUsd: '0',
        },
        crossMarginSummary: {
          accountValue: '0',
          totalMarginUsed: '0',
          totalNtlPos: '0',
          totalRawUsd: '0',
        },
        withdrawable: '0',
        assetPositions: []
      });
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadAccount();

    if (autoRefresh && address) {
      const interval = setInterval(loadAccount, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [address, autoRefresh, loadAccount]);

  const refresh = useCallback(() => {
    return loadAccount();
  }, [loadAccount]);

  return {
    accountInfo,
    loading,
    error,
    refresh
  };
};
