import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { use01Orderbook } from '@/hooks/use01Orderbook';
import { AlertTriangle } from 'lucide-react';

interface O1OrderbookProps {
  symbol: string | null;
  onPriceSelect?: (price: number) => void;
}

export const O1Orderbook = ({ symbol, onPriceSelect }: O1OrderbookProps) => {
  const { orderbook, loading, error } = use01Orderbook(symbol);

  if (!symbol) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-muted-foreground text-sm">Select a market</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-1 p-3">
        {[...Array(20)].map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4 text-destructive">
        <AlertTriangle className="h-4 w-4 mr-2" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!orderbook) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-muted-foreground text-sm">No orderbook data</p>
      </div>
    );
  }

  const maxBidSize = Math.max(...orderbook.bids.map(b => b.size));
  const maxAskSize = Math.max(...orderbook.asks.map(a => a.size));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="grid grid-cols-3 text-xs font-semibold text-muted-foreground">
          <div>Price</div>
          <div className="text-right">Size</div>
          <div className="text-right">Total</div>
        </div>
      </div>

      {/* Asks (Sell Orders) - Top half */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col-reverse p-3 space-y-0.5 space-y-reverse">
          {orderbook.asks.slice(0, 15).reverse().map((ask, i) => {
            const depthPercent = (ask.size / maxAskSize) * 100;
            return (
              <button
                key={`ask-${i}`}
                onClick={() => onPriceSelect?.(ask.price)}
                className="relative grid grid-cols-3 text-xs py-1 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <div
                  className="absolute right-0 top-0 bottom-0 bg-status-error/10"
                  style={{ width: `${depthPercent}%` }}
                />
                <div className="relative text-status-error font-medium">
                  {ask.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="relative text-right text-foreground">
                  {ask.size.toFixed(4)}
                </div>
                <div className="relative text-right text-muted-foreground">
                  {ask.total.toFixed(2)}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Spread */}
      <div className="p-3 border-y border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Spread</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              ${orderbook.spread.toFixed(2)}
            </span>
            <Badge variant="outline" className="text-xs">
              {orderbook.spreadPercent.toFixed(3)}%
            </Badge>
          </div>
        </div>
      </div>

      {/* Bids (Buy Orders) - Bottom half */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-0.5">
          {orderbook.bids.slice(0, 15).map((bid, i) => {
            const depthPercent = (bid.size / maxBidSize) * 100;
            return (
              <button
                key={`bid-${i}`}
                onClick={() => onPriceSelect?.(bid.price)}
                className="relative grid grid-cols-3 text-xs py-1 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <div
                  className="absolute right-0 top-0 bottom-0 bg-status-success/10"
                  style={{ width: `${depthPercent}%` }}
                />
                <div className="relative text-status-success font-medium">
                  {bid.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="relative text-right text-foreground">
                  {bid.size.toFixed(4)}
                </div>
                <div className="relative text-right text-muted-foreground">
                  {bid.total.toFixed(2)}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
