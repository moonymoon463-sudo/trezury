import { useState, useEffect } from 'react';
import { dydxMarketService } from '@/services/dydxMarketService';
import type { DydxCandle } from '@/types/dydx';

export const useDydxCandles = (
  symbol: string | null,
  resolution: string = '1HOUR',
  limit: number = 100
) => {
  const [candles, setCandles] = useState<DydxCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setCandles([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadCandles = async () => {
      try {
        setLoading(true);
        const data = await dydxMarketService.getCandles(symbol, resolution, limit);
        if (mounted) {
          setCandles(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load candles');
          console.error('[useDydxCandles] Error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadCandles();

    return () => {
      mounted = false;
    };
  }, [symbol, resolution, limit]);

  return { candles, loading, error };
};
