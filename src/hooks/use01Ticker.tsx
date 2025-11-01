import { useState, useEffect } from 'react';
import { o1WebSocketService } from '@/services/o1WebSocketService';

export interface TickerData {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  fundingRate: number;
}

export const use01Ticker = (symbol: string | null) => {
  const [ticker, setTicker] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    // Subscribe to real-time ticker updates
    const unsubscribe = o1WebSocketService.subscribeToTicker(symbol, (data) => {
      if (mounted) {
        setTicker({
          symbol,
          price: data.price || 0,
          change24h: data.change24h || 0,
          high24h: data.high24h || 0,
          low24h: data.low24h || 0,
          volume24h: data.volume24h || 0,
          fundingRate: data.fundingRate || 0,
        });
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [symbol]);

  return { ticker, loading };
};
