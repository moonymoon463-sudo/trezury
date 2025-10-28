import { useMemo, useState, memo, useEffect } from 'react';
import { useDydxOrderbook } from '@/hooks/useDydxOrderbook';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OrderBookProps {
  symbol: string | null;
  onPriceSelect?: (price: number) => void;
}

interface OrderBookRowProps {
  price: string;
  size: string;
  total: number;
  type: 'bid' | 'ask';
  depthPercent: number;
  isSelected: boolean;
  onSelect: (price: number) => void;
}

const OrderBookRow = memo(({ price, size, total, type, depthPercent, isSelected, onSelect }: OrderBookRowProps) => {
  const priceNum = parseFloat(price);
  const sizeNum = parseFloat(size);
  
  return (
    <div 
      onClick={() => onSelect(priceNum)}
      className={cn(
        "relative cursor-pointer transition-colors hover:bg-[#463c25]/20",
        isSelected && "bg-[#463c25]/40"
      )}
    >
      <div 
        className={cn(
          "absolute inset-0",
          type === 'ask' ? "bg-red-500/10" : "bg-green-500/10"
        )}
        style={{ width: `${depthPercent}%` }}
      />
      <div className="relative grid grid-cols-3 gap-2 text-xs px-1 py-0.5">
        <div className={cn(
          "font-medium",
          type === 'ask' ? "text-red-500" : "text-green-500"
        )}>
          {priceNum.toFixed(2)}
        </div>
        <div className="text-right text-foreground">{sizeNum.toFixed(4)}</div>
        <div className="text-right text-muted-foreground">{total.toFixed(4)}</div>
      </div>
    </div>
  );
});

export const OrderBook = ({ symbol, onPriceSelect }: OrderBookProps) => {
  const { orderbook, loading } = useDydxOrderbook(symbol);
  const [viewMode, setViewMode] = useState<'compact' | 'full'>('compact');
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  const depth = viewMode === 'compact' ? 3 : 25;

  const { bids, asks, spread, spreadPercent } = useMemo(() => {
    if (!orderbook) return { bids: [], asks: [], spread: 0, spreadPercent: 0 };

    // Defensive sorting before slicing (service should already sort, but be robust)
    const bidsSorted = [...orderbook.bids].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    const asksSorted = [...orderbook.asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    
    const topBids = bidsSorted.slice(0, depth);
    const topAsks = asksSorted.slice(0, depth);

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
      asks: asksWithTotal,
      spread,
      spreadPercent
    };
  }, [orderbook, depth]);

  const handlePriceSelect = (price: number) => {
    setSelectedPrice(price);
    onPriceSelect?.(price);
  };

  const maxBidTotal = bids[bids.length - 1]?.total || 1;
  const maxAskTotal = asks[asks.length - 1]?.total || 1;

  useEffect(() => {
    if (orderbook) {
      console.log('[OrderBook] Data update:', {
        market: orderbook.market,
        bidsCount: orderbook.bids.length,
        asksCount: orderbook.asks.length,
        bestBid: orderbook.bids[0]?.price,
        bestAsk: orderbook.asks[0]?.price,
        viewMode,
        depth
      });
    }
  }, [orderbook, viewMode, depth]);

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

  const orderbookContent = (
    <>
      {/* Header */}
      <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground mb-1 px-1">
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>

      {/* Asks (Sells) - Red - Reversed to show highest first, best ask closest to spread */}
      <div>
        {[...asks].reverse().map((ask, idx) => {
          const depthPercent = (ask.total / maxAskTotal) * 100;
          return (
            <OrderBookRow
              key={`ask-${ask.price}`}
              price={ask.price}
              size={ask.size}
              total={ask.total}
              type="ask"
              depthPercent={depthPercent}
              isSelected={selectedPrice === parseFloat(ask.price)}
              onSelect={handlePriceSelect}
            />
          );
        })}
      </div>

      {/* Current Price / Spread - Compact */}
      <div className="text-center py-1 border-y border-[#463c25] my-0.5 bg-[#211d12]/30">
        <div className="text-xs font-bold text-[#e6b951]">
          ${parseFloat(asks[0]?.price || '0').toFixed(2)} 
          <span className="text-[9px] text-muted-foreground mx-1">|</span>
          ${parseFloat(bids[0]?.price || '0').toFixed(2)}
        </div>
      </div>

      {/* Bids (Buys) - Green */}
      <div>
        {bids.map((bid, idx) => {
          const depthPercent = (bid.total / maxBidTotal) * 100;
          return (
            <OrderBookRow
              key={`bid-${bid.price}`}
              price={bid.price}
              size={bid.size}
              total={bid.total}
              type="bid"
              depthPercent={depthPercent}
              isSelected={selectedPrice === parseFloat(bid.price)}
              onSelect={handlePriceSelect}
            />
          );
        })}
      </div>
    </>
  );

  return (
    <div className="bg-[#2a251a] border border-[#463c25] rounded-lg p-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-xs font-semibold text-foreground">Order Book</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'compact' ? 'full' : 'compact')}
            className="h-5 px-1.5 text-[9px] bg-[#463c25]/30 border-[#635636] hover:bg-[#463c25]/50"
          >
            {viewMode === 'compact' ? 'Full' : 'Compact'}
          </Button>
        </div>
        <div className="text-[9px] text-muted-foreground">
          ${spread.toFixed(2)} ({spreadPercent.toFixed(3)}%)
        </div>
      </div>

      {viewMode === 'full' ? (
        <div className="space-y-0">
          {/* Header */}
          <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground mb-1 px-1">
            <div>Price</div>
            <div className="text-right">Size</div>
            <div className="text-right">Total</div>
          </div>

          {/* Asks Section - Scrollable */}
          <ScrollArea className="h-[180px]">
            <div className="pr-2">
              {[...asks].reverse().map((ask) => {
                const depthPercent = (ask.total / maxAskTotal) * 100;
                return (
                  <OrderBookRow
                    key={`ask-${ask.price}`}
                    price={ask.price}
                    size={ask.size}
                    total={ask.total}
                    type="ask"
                    depthPercent={depthPercent}
                    isSelected={selectedPrice === parseFloat(ask.price)}
                    onSelect={handlePriceSelect}
                  />
                );
              })}
            </div>
          </ScrollArea>

          {/* Spread - Fixed */}
          <div className="text-center py-1 border-y border-[#463c25] my-0.5 bg-[#211d12]/30">
            <div className="text-xs font-bold text-[#e6b951]">
              ${parseFloat(asks[0]?.price || '0').toFixed(2)} 
              <span className="text-[9px] text-muted-foreground mx-1">|</span>
              ${parseFloat(bids[0]?.price || '0').toFixed(2)}
            </div>
          </div>

          {/* Bids Section - Scrollable */}
          <ScrollArea className="h-[180px]">
            <div className="pr-2">
              {bids.map((bid) => {
                const depthPercent = (bid.total / maxBidTotal) * 100;
                return (
                  <OrderBookRow
                    key={`bid-${bid.price}`}
                    price={bid.price}
                    size={bid.size}
                    total={bid.total}
                    type="bid"
                    depthPercent={depthPercent}
                    isSelected={selectedPrice === parseFloat(bid.price)}
                    onSelect={handlePriceSelect}
                  />
                );
              })}
            </div>
          </ScrollArea>
        </div>
      ) : (
        orderbookContent
      )}
    </div>
  );
};
