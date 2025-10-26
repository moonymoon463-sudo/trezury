import { useState, useEffect, useCallback } from 'react';
import { dydxTradingService } from '@/services/dydxTradingService';
import type { DydxAccountInfo } from '@/types/dydx-trading';

export const useDydxAccount = (address?: string, autoRefresh: boolean = true) => {
  const [accountInfo, setAccountInfo] = useState<DydxAccountInfo | null>(null);
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
      const info = await dydxTradingService.getAccountInfo(address);
      setAccountInfo(info);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load account';
      setError(errorMsg);
      console.error('[useDydxAccount] Error:', err);
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
