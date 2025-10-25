import { useState, useEffect, useCallback } from 'react';
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

  // Load initial candles
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
          // Ensure ascending order
          const sortedData = (data || []).sort((a, b) => a.timestamp - b.timestamp);
          setCandles(sortedData);
          setError(null);
          setHasMore(data && data.length >= limit);
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

  // Subscribe to real-time WebSocket updates
  useEffect(() => {
    if (!symbol) return;

    console.log('[useDydxCandles] Subscribing to WebSocket for', symbol);
    
    const unsubscribe = dydxWebSocketService.subscribeToCandles(
      symbol,
      resolution,
      (data) => {
        console.log('[useDydxCandles] WebSocket candle update:', data);
        setCandles(prev => {
          // The WebSocket service now sends normalized data with numeric timestamp
          if (!data || !data.timestamp) return prev;
          
          const newCandles = [...prev];
          const existingIndex = newCandles.findIndex(c => c.timestamp === data.timestamp);
          
          const newCandle: DydxCandle = {
            timestamp: data.timestamp,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
          };

          if (existingIndex >= 0) {
            // Update existing candle
            newCandles[existingIndex] = newCandle;
          } else {
            // Append new candle and maintain ascending order
            newCandles.push(newCandle);
            newCandles.sort((a, b) => a.timestamp - b.timestamp);
          }
          
          return newCandles;
        });
      }
    );

    return () => {
      console.log('[useDydxCandles] Unsubscribing from WebSocket');
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

  return { candles, loading, error, hasMore, loadMore };
};
