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
  const [loadedRange, setLoadedRange] = useState<{ start: number; end: number } | null>(null);

  // Load more historical candles when scrolling back
  const loadMoreHistory = useCallback(async () => {
    if (!market || !earliestTimestamp || isLoadingMore || !hasMoreHistory) return;

    setIsLoadingMore(true);
    try {
      const normalizedInterval = resolutionMap[interval] || interval;
      const historicalDepth = getHistoricalDepth(normalizedInterval);
      
      const endTime = earliestTimestamp - 1000; // 1 second before earliest
      const startTime = endTime - historicalDepth;

      console.log('[useHyperliquidCandles] Loading more history:', { 
        startTime: new Date(startTime).toISOString(), 
        endTime: new Date(endTime).toISOString() 
      });

      // STEP 1: Check database first
      const { data: dbCandles, error: dbError } = await supabase
        .from('hyperliquid_historical_candles')
        .select('*')
        .eq('market', market)
        .eq('interval', normalizedInterval)
        .gte('timestamp', startTime)
        .lt('timestamp', endTime)
        .order('timestamp', { ascending: true });

      let newCandles: HyperliquidCandle[] = [];

      if (!dbError && dbCandles && dbCandles.length > 0) {
        console.log('[useHyperliquidCandles] Loaded', dbCandles.length, 'historical candles from database');
        const intervalMs = getIntervalMilliseconds(normalizedInterval);
        newCandles = dbCandles.map(dc => ({
          t: dc.timestamp,
          T: dc.timestamp + intervalMs,
          s: dc.market,
          i: dc.interval,
          o: dc.open,
          c: dc.close,
          h: dc.high,
          l: dc.low,
          v: dc.volume,
          n: 0
        }));
      }

      // STEP 2: If database doesn't have enough, fetch from API
      if (newCandles.length === 0) {
        const { data: apiData, error: funcError } = await supabase.functions.invoke('hyperliquid-market-data', {
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

        if (Array.isArray(apiData) && apiData.length > 0) {
          newCandles = apiData;
          console.log('[useHyperliquidCandles] Loaded', newCandles.length, 'candles from API');
        }
      }

      if (newCandles.length > 0) {
        setCandles(prev => {
          const merged = [...newCandles, ...prev];
          // Remove duplicates and sort
          const uniqueMap = new Map<number, HyperliquidCandle>();
          merged.forEach(c => uniqueMap.set(c.t, c));
          return Array.from(uniqueMap.values()).sort((a, b) => a.t - b.t);
        });
        setEarliestTimestamp(newCandles[0].t);
        setLoadedRange(prev => prev ? { start: newCandles[0].t, end: prev.end } : null);
        console.log('[useHyperliquidCandles] Loaded', newCandles.length, 'more candles');
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
      setLoadedRange(null);
      return;
    }

    let mounted = true;

    const loadCandles = async () => {
      try {
        setLoading(true);
        setError(null);

        // Normalize interval format
        const normalizedInterval = resolutionMap[interval] || interval;
        
        // Calculate proper time range for initial load
        const endTime = Date.now();
        const historicalDepth = getHistoricalDepth(normalizedInterval);
        const startTime = endTime - historicalDepth;

        console.log('[useHyperliquidCandles] Loading candles:', { 
          market, 
          interval: normalizedInterval, 
          startTime: new Date(startTime).toISOString(), 
          endTime: new Date(endTime).toISOString()
        });

        // Try API first
        const { data: apiData, error: funcError } = await supabase.functions.invoke('hyperliquid-market-data', {
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

        let allCandles: HyperliquidCandle[] = Array.isArray(apiData) ? apiData : [];

        if (funcError || allCandles.length === 0) {
          console.warn('[useHyperliquidCandles] API unavailable or empty, falling back to cached DB candles', funcError);
          // Fallback to database cached candles
          const { data: dbCandles, error: dbError } = await supabase
            .from('hyperliquid_historical_candles')
            .select('*')
            .eq('market', market)
            .eq('interval', normalizedInterval)
            .gte('timestamp', startTime)
            .lte('timestamp', endTime)
            .order('timestamp', { ascending: true });

          if (!dbError && dbCandles && dbCandles.length > 0) {
            const intervalMs = getIntervalMilliseconds(normalizedInterval);
            allCandles = dbCandles.map(dc => ({
              t: dc.timestamp,
              T: dc.timestamp + intervalMs,
              s: dc.market,
              i: dc.interval,
              o: dc.open,
              c: dc.close,
              h: dc.high,
              l: dc.low,
              v: dc.volume,
              n: 0
            }));
            console.log('[useHyperliquidCandles] Loaded', allCandles.length, 'candles from DB fallback');
          } else if (dbError) {
            console.error('[useHyperliquidCandles] DB fallback error:', dbError);
          }
        }

        if (mounted && allCandles.length > 0) {
          setCandles(allCandles);
          setEarliestTimestamp(allCandles[0].t);
          setLoadedRange({ start: allCandles[0].t, end: allCandles[allCandles.length - 1].t });
          setHasMoreHistory(true);
          
          console.log('[useHyperliquidCandles] Loaded candles:', {
            totalCandles: allCandles.length,
            earliest: new Date(allCandles[0].t).toISOString(),
            latest: new Date(allCandles[allCandles.length - 1].t).toISOString()
          });
        } else if (mounted) {
          setCandles([]);
          setLoadedRange(null);
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
