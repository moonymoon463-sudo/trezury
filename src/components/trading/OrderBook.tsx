import { useMemo } from 'react';
import { useDydxOrderbook } from '@/hooks/useDydxOrderbook';
import { Skeleton } from '@/components/ui/skeleton';

interface OrderBookProps {
  symbol: string | null;
}

export const OrderBook = ({ symbol }: OrderBookProps) => {
  const { orderbook, loading } = useDydxOrderbook(symbol);

  const { bids, asks, spread, spreadPercent } = useMemo(() => {
    if (!orderbook) return { bids: [], asks: [], spread: 0, spreadPercent: 0 };

    const topBids = orderbook.bids.slice(0, 7);
    const topAsks = orderbook.asks.slice(0, 7);

    // Calculate spread
    const bestBid = parseFloat(topBids[0]?.price || '0');
    const bestAsk = parseFloat(topAsks[0]?.price || '0');
    const spread = bestAsk - bestBid;
    const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;

    // Add cumulative totals
    let bidTotal = 0;
    const bidsWithTotal = topBids.map(bid => {
      const size = parseFloat(bid.size);
      bidTotal += size;
      return { ...bid, total: bidTotal };
    });

    let askTotal = 0;
    const asksWithTotal = topAsks.map(ask => {
      const size = parseFloat(ask.size);
      askTotal += size;
      return { ...ask, total: askTotal };
    });

    return {
      bids: bidsWithTotal,
      asks: asksWithTotal.reverse(),
      spread,
      spreadPercent
    };
  }, [orderbook]);

  const maxBidTotal = bids[bids.length - 1]?.total || 1;
  const maxAskTotal = asks[0]?.total || 1;

  if (loading) {
    return (
      <div className="bg-[#2a251a] border border-[#463c25] rounded-lg p-3">
        <div className="mb-2">
          <Skeleton className="h-4 w-24" />
        </div>
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="h-5 w-full mb-1" />
        ))}
      </div>
    );
  }

  if (!orderbook || !symbol) {
    return (
      <div className="bg-[#2a251a] border border-[#463c25] rounded-lg p-3">
        <div className="text-xs text-muted-foreground text-center py-4">
          Select a market to view order book
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#2a251a] border border-[#463c25] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-foreground">Order Book</h3>
        <div className="text-[10px] text-muted-foreground">
          Spread: <span className="text-foreground">${spread.toFixed(2)}</span> ({spreadPercent.toFixed(3)}%)
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground mb-1 px-1">
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>

      {/* Asks (Sells) - Red */}
      <div className="mb-1">
        {asks.map((ask, idx) => {
          const depthPercent = (ask.total / maxAskTotal) * 100;
          return (
            <div key={`ask-${idx}`} className="relative mb-0.5">
              <div 
                className="absolute inset-0 bg-red-500/10 rounded"
                style={{ width: `${depthPercent}%` }}
              />
              <div className="relative grid grid-cols-3 gap-2 text-[11px] px-1 py-0.5">
                <div className="text-red-500 font-medium">{parseFloat(ask.price).toFixed(2)}</div>
                <div className="text-right text-foreground">{parseFloat(ask.size).toFixed(4)}</div>
                <div className="text-right text-muted-foreground">{ask.total.toFixed(4)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current Price / Spread */}
      <div className="text-center py-1 border-y border-[#463c25] my-1">
        <div className="text-xs font-bold text-[#e6b951]">
          ${parseFloat(asks[asks.length - 1]?.price || '0').toFixed(2)}
        </div>
      </div>

      {/* Bids (Buys) - Green */}
      <div className="mt-1">
        {bids.map((bid, idx) => {
          const depthPercent = (bid.total / maxBidTotal) * 100;
          return (
            <div key={`bid-${idx}`} className="relative mb-0.5">
              <div 
                className="absolute inset-0 bg-green-500/10 rounded"
                style={{ width: `${depthPercent}%` }}
              />
              <div className="relative grid grid-cols-3 gap-2 text-[11px] px-1 py-0.5">
                <div className="text-green-500 font-medium">{parseFloat(bid.price).toFixed(2)}</div>
                <div className="text-right text-foreground">{parseFloat(bid.size).toFixed(4)}</div>
                <div className="text-right text-muted-foreground">{bid.total.toFixed(4)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
