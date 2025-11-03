import { useState, useEffect, useRef } from 'react';
import { hyperliquidWebSocketService } from '@/services/hyperliquidWebSocketService';
import type { HyperliquidOrderbook } from '@/types/hyperliquid';

// Throttle function to limit update frequency
const throttle = <T extends (...args: any[]) => void>(func: T, delay: number): T => {
  let lastCall = 0;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  }) as T;
};

export const useHyperliquidOrderbook = (market: string | null) => {
  const [orderbook, setOrderbook] = useState<HyperliquidOrderbook | null>(null);
  const [loading, setLoading] = useState(true);
  const lastNonEmpty = useRef<HyperliquidOrderbook | null>(null);
  
  const throttledSetOrderbook = useRef(
    throttle((book: HyperliquidOrderbook) => {
      // Prevent empty flash by ignoring updates with no orders if we have a good state
      if ((book.levels[0].length === 0 && book.levels[1].length === 0) && lastNonEmpty.current) {
        return;
      }
      
      setOrderbook(book);
      
      // Save last good state
      if (book.levels[0].length > 0 || book.levels[1].length > 0) {
        lastNonEmpty.current = book;
      }
      
      setLoading(false);
    }, 300) // Update max every 300ms
  ).current;

  useEffect(() => {
    if (!market) {
      setOrderbook(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    const unsubscribe = hyperliquidWebSocketService.subscribeToOrderbook(
      market,
      (updatedOrderbook) => {
        if (mounted) {
          throttledSetOrderbook(updatedOrderbook);
        }
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [market, throttledSetOrderbook]);

  return { orderbook, loading };
};
