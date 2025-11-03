import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { HyperliquidCandle } from '@/types/hyperliquid';

export const useHyperliquidCandles = (
  market: string | null,
  interval: string = '1m',
  limit: number = 200
) => {
  const [candles, setCandles] = useState<HyperliquidCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!market) {
      setCandles([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadCandles = async () => {
      try {
        setLoading(true);
        setError(null);

        const endTime = Date.now();
        const startTime = endTime - (limit * getIntervalMilliseconds(interval));

        const { data, error: funcError } = await supabase.functions.invoke('hyperliquid-market-data', {
          body: {
            operation: 'get_candles',
            params: {
              market,
              interval,
              startTime,
              endTime
            }
          }
        });

        if (funcError) throw funcError;

        if (mounted) {
          setCandles(data || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load candles');
          console.error('[useHyperliquidCandles] Error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadCandles();

    // Refresh candles periodically based on interval
    const refreshInterval = getIntervalMilliseconds(interval);
    const timer = setInterval(loadCandles, refreshInterval);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [market, interval, limit]);

  return { candles, loading, error };
};

function getIntervalMilliseconds(interval: string): number {
  const match = interval.match(/^(\d+)([mhd])$/);
  if (!match) return 60000; // default 1 minute

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 60000;
  }
}
