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
    console.log('[useDydxCandles] Hook triggered', { symbol, resolution, limit });

    if (!symbol) {
      console.warn('[useDydxCandles] No symbol provided, skipping fetch');
      setCandles([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadCandles = async () => {
      try {
        console.log('[useDydxCandles] Starting fetch for', symbol);
        setLoading(true);
        setError(null);
        
        const data = await dydxMarketService.getCandles(symbol, resolution, limit);
        
        console.log('[useDydxCandles] Received candles:', data?.length || 0, 'candles');
        
        if (mounted) {
          setCandles(data || []);
          setError(null);
        }
      } catch (err) {
        console.error('[useDydxCandles] Error fetching candles:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load candles');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadCandles();

    return () => {
      console.log('[useDydxCandles] Cleanup called for', symbol);
      mounted = false;
    };
  }, [symbol, resolution, limit]);

  return { candles, loading, error };
};
