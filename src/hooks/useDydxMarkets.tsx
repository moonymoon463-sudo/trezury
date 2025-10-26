import { useState, useEffect } from 'react';
import { dydxMarketService } from '@/services/dydxMarketService';
import type { DydxMarket } from '@/types/dydx';

export const useDydxMarkets = () => {
  const [markets, setMarkets] = useState<DydxMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadMarkets = async () => {
      try {
        setLoading(true);
        const data = await dydxMarketService.getMarkets();
        if (mounted) {
          setMarkets(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load markets');
          console.error('[useDydxMarkets] Error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMarkets();

    // Subscribe to real-time updates
    dydxMarketService.startRealTimeUpdates(10000);
    const unsubscribe = dydxMarketService.subscribe((updatedMarkets) => {
      if (mounted) {
        setMarkets(updatedMarkets);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const refreshMarkets = async () => {
    try {
      setLoading(true);
      const data = await dydxMarketService.getMarkets();
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
