import { useState, useEffect, useRef } from 'react';
import { dydxWebSocketService } from '@/services/dydxWebSocketService';
import type { DydxOrderbook } from '@/types/dydx';

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

export const useDydxOrderbook = (symbol: string | null) => {
  const [orderbook, setOrderbook] = useState<DydxOrderbook | null>(null);
  const [loading, setLoading] = useState(true);
  const lastNonEmpty = useRef<DydxOrderbook | null>(null);
  
  const throttledSetOrderbook = useRef(
    throttle((book: DydxOrderbook) => {
      // Prevent empty flash by ignoring updates with no orders if we have a good state
      if ((book.bids.length === 0 && book.asks.length === 0) && lastNonEmpty.current) {
        return;
      }
      
      setOrderbook(book);
      
      // Save last good state
      if (book.bids.length > 0 || book.asks.length > 0) {
        lastNonEmpty.current = book;
      }
      
      setLoading(false);
    }, 300) // Update max every 300ms
  ).current;

  useEffect(() => {
    if (!symbol) {
      setOrderbook(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    const unsubscribe = dydxWebSocketService.subscribeToOrderbook(
      symbol,
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
  }, [symbol]);

  return { orderbook, loading };
};
