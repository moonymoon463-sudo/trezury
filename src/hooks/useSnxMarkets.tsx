/**
 * Hook for Synthetix market data
 */

import { useState, useEffect } from 'react';
import { snxPerpsClient } from '@/lib/snx/perpsClient';
import type { SnxMarket } from '@/types/snx';

export const useSnxMarkets = (chainId: number = 8453) => {
  const [markets, setMarkets] = useState<SnxMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadMarkets = async () => {
      try {
        setLoading(true);
        const { SynthetixPerpsClient } = await import('@/lib/snx/perpsClient');
        const client = new SynthetixPerpsClient(chainId);
        const data = await client.getMarkets();
        
        if (mounted) {
          setMarkets(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load markets');
          console.error('[useSnxMarkets] Error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMarkets();

    // Refresh every 20 seconds
    const interval = setInterval(loadMarkets, 20000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [chainId]);

  const refreshMarkets = async () => {
    try {
      setLoading(true);
      const { SynthetixPerpsClient } = await import('@/lib/snx/perpsClient');
      const client = new SynthetixPerpsClient(chainId);
      const data = await client.getMarkets();
      setMarkets(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh markets');
    } finally {
      setLoading(false);
    }
  };

  return { markets, loading, error, refreshMarkets };
};
