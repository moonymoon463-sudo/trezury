import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { HyperliquidCandle } from '@/types/hyperliquid';

// Resolution mapping from dashboard format to Hyperliquid API format
const resolutionMap: Record<string, string> = {
  '1MIN': '1m',
  '5MINS': '5m',
  '15MINS': '15m',
  '1HOUR': '1h',
  '4HOURS': '4h',
  '1DAY': '1d',
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

// Get historical depth in milliseconds for each interval (500 candles worth)
const getHistoricalDepth = (interval: string): number => {
  const map: Record<string, number> = {
    '1m': 500 * 60 * 1000,        // ~8 hours
    '5m': 500 * 5 * 60 * 1000,    // ~41 hours
    '15m': 500 * 15 * 60 * 1000,  // ~5 days
    '1h': 500 * 60 * 60 * 1000,   // ~20 days
    '4h': 500 * 4 * 60 * 60 * 1000, // ~83 days
    '1d': 500 * 24 * 60 * 60 * 1000, // ~16 months
  };
  return map[interval] || map['1h'];
};

// Target backfill depth to ensure robust history display
const getTargetHistoryDepth = (interval: string): number => {
  const DAY = 24 * 60 * 60 * 1000;
  const YEAR = 365 * DAY;
  const map: Record<string, number> = {
    '1m': 2 * DAY,      // avoid massive loads for 1m
    '5m': 14 * DAY,     // ~2 weeks
    '15m': 30 * DAY,    // ~1 month
    '1h': YEAR,         // 1 year minimum
    '4h': 2 * YEAR,     // 2 years
    '1d': 5 * YEAR,     // 5 years (near full history)
  };
  return map[interval] || YEAR;
};

export const useHyperliquidCandles = (
  market: string | null,
  interval: string = '1m',
  limit: number = 500
) => {
  const [candles, setCandles] = useState<HyperliquidCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [earliestTimestamp, setEarliestTimestamp] = useState<number | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Load more historical candles when scrolling back
  const loadMoreHistory = useCallback(async () => {
    if (!market || !earliestTimestamp || isLoadingMore || !hasMoreHistory) return;

    setIsLoadingMore(true);
    try {
      const normalizedInterval = resolutionMap[interval] || interval;
      const historicalDepth = getHistoricalDepth(normalizedInterval);
      
      const endTime = earliestTimestamp - 1000; // 1 second before earliest
      const startTime = endTime - historicalDepth;

      console.log('[useHyperliquidCandles] Loading more history:', { startTime, endTime, normalizedInterval });

      const { data, error: funcError } = await supabase.functions.invoke('hyperliquid-market-data', {
        body: {
          operation: 'get_candles',
          params: {
            market,
            interval: normalizedInterval,
            startTime,
            endTime
          }
        }
      });

      if (funcError) throw funcError;

      if (data && data.length > 0) {
        setCandles(prev => [...data, ...prev].sort((a, b) => a.t - b.t));
        setEarliestTimestamp(data[0].t);
        console.log('[useHyperliquidCandles] Loaded', data.length, 'more candles');
      } else {
        setHasMoreHistory(false);
        console.log('[useHyperliquidCandles] No more historical data available');
      }
    } catch (err) {
      console.error('[useHyperliquidCandles] Error loading more history:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [market, interval, earliestTimestamp, isLoadingMore, hasMoreHistory]);

  useEffect(() => {
    if (!market) {
      setCandles([]);
      setLoading(false);
      setEarliestTimestamp(null);
      setHasMoreHistory(true);
      return;
    }

    let mounted = true;

    const loadCandles = async () => {
      try {
        setLoading(true);
        setError(null);

        // Normalize interval format
        const normalizedInterval = resolutionMap[interval] || interval;
        
        // Calculate proper time range for 500 candles
        const endTime = Date.now();
        const historicalDepth = getHistoricalDepth(normalizedInterval);
        const startTime = endTime - historicalDepth;

        console.log('[useHyperliquidCandles] Fetching candles:', { 
          market, 
          interval, 
          normalizedInterval, 
          startTime: new Date(startTime).toISOString(), 
          endTime: new Date(endTime).toISOString(),
          expectedCandles: limit
        });

        const { data, error: funcError } = await supabase.functions.invoke('hyperliquid-market-data', {
          body: {
            operation: 'get_candles',
            params: {
              market,
              interval: normalizedInterval,
              startTime,
              endTime
            }
          }
        });

        if (funcError) throw funcError;

        console.log('[useHyperliquidCandles] Received candles:', data?.length || 0, 'for', market, normalizedInterval);
        console.log('[useHyperliquidCandles] First candle:', data?.[0]);
        console.log('[useHyperliquidCandles] Last candle:', data?.[data?.length - 1]);

        if (mounted && data) {
          setCandles(data);
          if (data.length > 0) {
            setEarliestTimestamp(data[0].t);
            setHasMoreHistory(true);
          }
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
    const refreshInterval = getIntervalMilliseconds(resolutionMap[interval] || interval);
    const timer = setInterval(loadCandles, refreshInterval);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [market, interval, limit]);

  return { 
    candles, 
    loading, 
    error, 
    loadMoreHistory, 
    isLoadingMore, 
    hasMoreHistory 
  };
};

function getIntervalMilliseconds(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1d': 86_400_000,
  };
  return map[interval] || 60_000;
}
