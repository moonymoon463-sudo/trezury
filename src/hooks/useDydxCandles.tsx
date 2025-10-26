import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { dydxMarketService } from '@/services/dydxMarketService';
import { dydxWebSocketService } from '@/services/dydxWebSocketService';
import type { DydxCandle } from '@/types/dydx';

export const useDydxCandles = (
  symbol: string | null,
  resolution: string = '1HOUR',
  limit: number = 100
) => {
  const [candles, setCandles] = useState<DydxCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isBackfilling, setIsBackfilling] = useState(false);

  // Load initial candles with 180-day backfill
  useEffect(() => {
    console.log('[useDydxCandles] Hook triggered', { symbol, resolution, limit });

    if (!symbol) {
      console.warn('[useDydxCandles] No symbol provided, skipping fetch');
      setCandles([]);
      setLoading(false);
      setIsBackfilling(false);
      return;
    }

    let mounted = true;

    const loadCandles = async () => {
      try {
        console.log('[useDydxCandles] Starting fetch for', symbol);
        setLoading(true);
        setError(null);
        setIsBackfilling(true);
        
        // Initial fetch to show chart quickly
        const data = await dydxMarketService.getCandles(symbol, resolution, limit);
        console.log('[useDydxCandles] Received initial candles:', data?.length || 0);
        
        if (!mounted) return;
        
        const sortedData = (data || []).sort((a, b) => a.timestamp - b.timestamp);
        setCandles(sortedData);
        setLoading(false); // Show chart immediately
        setError(null);
        setHasMore(data && data.length >= limit);

        // Background backfill (up to 1000 candles for performance)
        let allCandles = [...sortedData];
        const maxCandles = 1000;
        let fetchCount = 0;

        while (allCandles.length < maxCandles && fetchCount < 5 && mounted) {
          const oldestTime = allCandles[0]?.timestamp;
          if (!oldestTime) break;

          // Fetch older data without passing timestamp (API limitation)
          const moreData = await dydxMarketService.getCandles(symbol, resolution, limit);
          if (!moreData || moreData.length === 0 || !mounted) break;

          const olderCandles = moreData.filter(c => c.timestamp < oldestTime);
          if (olderCandles.length === 0) break;

          allCandles = [...olderCandles.sort((a, b) => a.timestamp - b.timestamp), ...allCandles];
          setCandles([...allCandles]);
          
          fetchCount++;
          await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit
        }

        if (mounted) {
          setIsBackfilling(false);
          console.log(`[useDydxCandles] Backfilled ${allCandles.length} candles`);
        }
      } catch (err) {
        console.error('[useDydxCandles] Error fetching candles:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load candles');
          setIsBackfilling(false);
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

  // Subscribe to real-time WebSocket updates with debouncing
  useEffect(() => {
    if (!symbol) return;

    console.log('[useDydxCandles] Subscribing to WebSocket for', symbol);
    
    let debounceTimer: NodeJS.Timeout | null = null;
    let pendingUpdate: DydxCandle | null = null;

    const unsubscribe = dydxWebSocketService.subscribeToCandles(
      symbol,
      resolution,
      (data) => {
        console.log('[useDydxCandles] WebSocket candle update:', data);
        
        // Store the latest update
        if (data && data.timestamp) {
          pendingUpdate = {
            timestamp: data.timestamp,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
          };

          // Debounce the state update
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          // Capture the value to avoid closure issues
          const updateToApply = pendingUpdate;
          debounceTimer = setTimeout(() => {
            if (!updateToApply) return;
            
            setCandles(prev => {
              const newCandles = [...prev];
              // Add null check to prevent reading timestamp of null
              const existingIndex = newCandles.findIndex(c => c && c.timestamp === updateToApply.timestamp);

              if (existingIndex >= 0) {
                // Update existing candle in place
                newCandles[existingIndex] = updateToApply;
              } else {
                // Append new candle (already sorted by timestamp on server)
                newCandles.push(updateToApply);
              }
              
              return newCandles;
            });

            pendingUpdate = null;
          }, 100); // 100ms debounce
        }
      }
    );

    return () => {
      console.log('[useDydxCandles] Unsubscribing from WebSocket');
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      unsubscribe();
    };
  }, [symbol, resolution]);

  // Load more historical data
  const loadMore = useCallback(async () => {
    if (!symbol || !hasMore || loading) return;

    try {
      const oldestTimestamp = candles.length > 0 ? candles[0].timestamp : Date.now() / 1000;
      console.log('[useDydxCandles] Loading more candles before', oldestTimestamp);
      
      const data = await dydxMarketService.getCandles(symbol, resolution, limit);
      
      if (data && data.length > 0) {
        const olderCandles = data.filter(c => c.timestamp < oldestTimestamp);
        if (olderCandles.length > 0) {
          setCandles(prev => [...olderCandles, ...prev]);
          setHasMore(olderCandles.length >= limit);
        } else {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[useDydxCandles] Error loading more candles:', err);
    }
  }, [symbol, resolution, limit, candles, hasMore, loading]);

  return { candles, loading, error, hasMore, isBackfilling, loadMore };
};
