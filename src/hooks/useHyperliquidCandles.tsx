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
        const { data: apiCandles, error: funcError } = await supabase.functions.invoke('hyperliquid-market-data', {
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

        if (apiCandles && apiCandles.length > 0) {
          newCandles = apiCandles;
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
    let currentRequestId = 0;

    const loadCandles = async () => {
      const requestId = ++currentRequestId;
      
      try {
        setLoading(true);
        setError(null);

        // Normalize interval format
        const normalizedInterval = resolutionMap[interval] || interval;
        
        // Calculate proper time range for initial load
        const endTime = Date.now();
        const historicalDepth = getHistoricalDepth(normalizedInterval);
        const startTime = endTime - historicalDepth;

        console.log('[useHyperliquidCandles] Loading candles (hybrid strategy):', { 
          market, 
          interval: normalizedInterval, 
          startTime: new Date(startTime).toISOString(), 
          endTime: new Date(endTime).toISOString()
        });

        // STEP 1: Try to load from database first (cached historical data)
        const { data: dbCandles, error: dbError } = await supabase
          .from('hyperliquid_historical_candles')
          .select('*')
          .eq('market', market)
          .eq('interval', normalizedInterval)
          .gte('timestamp', startTime)
          .lte('timestamp', endTime)
          .order('timestamp', { ascending: true });

        // Check if this request is still current
        if (!mounted || requestId !== currentRequestId) return;

        let allCandles: HyperliquidCandle[] = [];

        if (!dbError && dbCandles && dbCandles.length > 0) {
          console.log('[useHyperliquidCandles] Loaded', dbCandles.length, 'candles from database');
          
          // Transform database format to candle format
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
          
          // If we have good cache coverage, set state immediately
          if (allCandles.length > 50) {
            setCandles(allCandles);
            setEarliestTimestamp(allCandles[0].t);
            setLoadedRange({ start: allCandles[0].t, end: allCandles[allCandles.length - 1].t });
            setHasMoreHistory(true);
            setLoading(false);
            
            // For short intervals, background refresh latest data only
            if (normalizedInterval === '1m' || normalizedInterval === '5m') {
              const recentStartTime = endTime - getIntervalMilliseconds(normalizedInterval) * 10;
              fetchRecentCandles(market, normalizedInterval, recentStartTime, endTime, requestId);
            }
            return;
          }
        }

        // STEP 2: Fetch from API (either no cache or insufficient data)
        const { data: apiCandles, error: funcError } = await supabase.functions.invoke('hyperliquid-market-data', {
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

        // Check if this request is still current
        if (!mounted || requestId !== currentRequestId) return;

        if (funcError) {
          console.warn('[useHyperliquidCandles] API error:', funcError);
          // Use cached data if we have any
          if (allCandles.length > 0) {
            setCandles(allCandles);
            setEarliestTimestamp(allCandles[0].t);
            setLoadedRange({ start: allCandles[0].t, end: allCandles[allCandles.length - 1].t });
          } else {
            throw funcError;
          }
        } else if (apiCandles && apiCandles.length > 0) {
          console.log('[useHyperliquidCandles] Received', apiCandles.length, 'candles from API');
          
          // STEP 3: Merge database and API candles, preferring API data for overlaps
          const candleMap = new Map<number, HyperliquidCandle>();
          
          // Add database candles first
          allCandles.forEach(c => candleMap.set(c.t, c));
          
          // Override with API candles (more recent/accurate)
          apiCandles.forEach((c: HyperliquidCandle) => candleMap.set(c.t, c));
          
          // Convert back to sorted array
          allCandles = Array.from(candleMap.values()).sort((a, b) => a.t - b.t);
          
          setCandles(allCandles);
          setEarliestTimestamp(allCandles[0].t);
          setLoadedRange({ start: allCandles[0].t, end: allCandles[allCandles.length - 1].t });
          setHasMoreHistory(true);
          
          console.log('[useHyperliquidCandles] Final dataset:', {
            totalCandles: allCandles.length,
            earliest: new Date(allCandles[0].t).toISOString(),
            latest: new Date(allCandles[allCandles.length - 1].t).toISOString()
          });
        } else if (allCandles.length === 0) {
          setCandles([]);
          setLoadedRange(null);
        }
      } catch (err) {
        if (mounted && requestId === currentRequestId) {
          setError(err instanceof Error ? err.message : 'Failed to load candles');
          console.error('[useHyperliquidCandles] Error:', err);
        }
      } finally {
        if (mounted && requestId === currentRequestId) {
          setLoading(false);
        }
      }
    };

    // Background fetch for recent candles only
    const fetchRecentCandles = async (
      market: string,
      interval: string,
      startTime: number,
      endTime: number,
      requestId: number
    ) => {
      try {
        const { data, error } = await supabase.functions.invoke('hyperliquid-market-data', {
          body: {
            operation: 'get_candles',
            params: { market, interval, startTime, endTime }
          }
        });

        if (!mounted || requestId !== currentRequestId || error || !data) return;

        setCandles(prev => {
          const candleMap = new Map<number, HyperliquidCandle>();
          prev.forEach(c => candleMap.set(c.t, c));
          data.forEach((c: HyperliquidCandle) => candleMap.set(c.t, c));
          return Array.from(candleMap.values()).sort((a, b) => a.t - b.t);
        });
      } catch (err) {
        console.warn('[useHyperliquidCandles] Background refresh failed:', err);
      }
    };

    loadCandles();

    // Adaptive refresh interval based on timeframe
    const getRefreshMs = () => {
      const normalized = resolutionMap[interval] || interval;
      if (normalized === '1m') return 60_000; // 1 minute
      if (normalized === '5m') return 300_000; // 5 minutes
      if (normalized === '15m') return 900_000; // 15 minutes
      return getIntervalMilliseconds(normalized); // Match candle interval
    };

    const timer = setInterval(loadCandles, getRefreshMs());

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
