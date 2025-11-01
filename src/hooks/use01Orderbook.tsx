import { useState, useEffect } from 'react';
import { o1WebSocketService } from '@/services/o1WebSocketService';
import { zoTradingService } from '@/exchanges/01protocol/tradingService';

export interface OrderbookLevel {
  price: number;
  size: number;
  total: number;
}

export interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  spread: number;
  spreadPercent: number;
}

export const use01Orderbook = (symbol: string | null) => {
  const [orderbook, setOrderbook] = useState<Orderbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setLoading(false);
      return;
    }

    let mounted = true;

    // Fetch initial orderbook
    const fetchInitialOrderbook = async () => {
      try {
        setLoading(true);
        const data = await zoTradingService.getOrderbook(symbol);
        
        if (mounted && data) {
          setOrderbook(processOrderbook(data));
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch orderbook');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchInitialOrderbook();

    // Subscribe to real-time updates
    const unsubscribe = o1WebSocketService.subscribeToOrderbook(symbol, (data) => {
      if (mounted) {
        setOrderbook(processOrderbook(data));
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [symbol]);

  return { orderbook, loading, error };
};

function processOrderbook(data: any): Orderbook {
  // Process bids (buy orders) - descending by price
  const bids: OrderbookLevel[] = [];
  let bidTotal = 0;
  
  if (data.bids) {
    for (const [price, size] of data.bids) {
      bidTotal += size;
      bids.push({
        price: parseFloat(price),
        size: parseFloat(size),
        total: bidTotal,
      });
    }
  }

  // Process asks (sell orders) - ascending by price
  const asks: OrderbookLevel[] = [];
  let askTotal = 0;
  
  if (data.asks) {
    for (const [price, size] of data.asks) {
      askTotal += size;
      asks.push({
        price: parseFloat(price),
        size: parseFloat(size),
        total: askTotal,
      });
    }
  }

  // Calculate spread
  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  const spread = bestAsk - bestBid;
  const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;

  return {
    bids,
    asks,
    spread,
    spreadPercent,
  };
}
