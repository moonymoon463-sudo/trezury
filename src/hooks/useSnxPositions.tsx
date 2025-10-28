/**
 * Hook for Synthetix position management
 */

import { useState, useEffect } from 'react';
import { snxTradingService } from '@/services/snxTradingService';
import type { SnxPosition } from '@/types/snx';

export const useSnxPositions = (accountId?: bigint, chainId: number = 8453) => {
  const [positions, setPositions] = useState<SnxPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) {
      setPositions([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadPositions = async () => {
      try {
        setLoading(true);
        const data = await snxTradingService.getOpenPositions(accountId, chainId);
        if (mounted) {
          setPositions(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load positions');
          console.error('[useSnxPositions] Error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadPositions();

    // Refresh positions every 30 seconds
    const interval = setInterval(loadPositions, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [accountId, chainId]);

  const refreshPositions = async () => {
    if (!accountId) return;

    try {
      setLoading(true);
      const data = await snxTradingService.getOpenPositions(accountId, chainId);
      setPositions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh positions');
    } finally {
      setLoading(false);
    }
  };

  return { positions, loading, error, refreshPositions };
};
