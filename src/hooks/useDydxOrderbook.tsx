import { useState, useEffect } from 'react';
import { dydxWebSocketService } from '@/services/dydxWebSocketService';
import type { DydxOrderbook } from '@/types/dydx';

export const useDydxOrderbook = (symbol: string | null) => {
  const [orderbook, setOrderbook] = useState<DydxOrderbook | null>(null);
  const [loading, setLoading] = useState(true);

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
          setOrderbook(updatedOrderbook);
          setLoading(false);
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
