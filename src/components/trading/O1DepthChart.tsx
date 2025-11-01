import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { use01Orderbook } from '@/hooks/use01Orderbook';
import { Skeleton } from '@/components/ui/skeleton';

interface O1DepthChartProps {
  symbol: string | null;
}

export const O1DepthChart = ({ symbol }: O1DepthChartProps) => {
  const { orderbook, loading } = use01Orderbook(symbol);

  const chartData = useMemo(() => {
    if (!orderbook) return null;

    // Aggregate bids and asks for depth visualization
    const bids = orderbook.bids.map(bid => ({
      price: bid.price,
      total: bid.total,
      type: 'bid' as const,
    }));

    const asks = orderbook.asks.map(ask => ({
      price: ask.price,
      total: ask.total,
      type: 'ask' as const,
    }));

    return { bids, asks };
  }, [orderbook]);

  if (!symbol) {
    return (
      <Card className="h-full bg-card/50 border-border/40 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Select a market</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="h-full bg-card/50 border-border/40 p-4">
        <Skeleton className="w-full h-full" />
      </Card>
    );
  }

  if (!chartData) {
    return (
      <Card className="h-full bg-card/50 border-border/40 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No depth data</p>
      </Card>
    );
  }

  const maxTotal = Math.max(
    ...chartData.bids.map(b => b.total),
    ...chartData.asks.map(a => a.total)
  );

  const midPrice = orderbook
    ? (orderbook.bids[0]?.price + orderbook.asks[0]?.price) / 2
    : 0;

  return (
    <Card className="h-full bg-card/50 border-border/40 overflow-hidden">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Market Depth</h3>
        
        <div className="relative h-48">
          {/* SVG Depth Chart */}
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
            {/* Bids (Green) */}
            <path
              d={createPath(chartData.bids, maxTotal, 'left')}
              fill="hsl(var(--status-success))"
              fillOpacity="0.2"
              stroke="hsl(var(--status-success))"
              strokeWidth="0.5"
            />
            
            {/* Asks (Red) */}
            <path
              d={createPath(chartData.asks, maxTotal, 'right')}
              fill="hsl(var(--status-error))"
              fillOpacity="0.2"
              stroke="hsl(var(--status-error))"
              strokeWidth="0.5"
            />
            
            {/* Mid price line */}
            <line
              x1="50"
              y1="0"
              x2="50"
              y2="100"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="0.3"
              strokeDasharray="2,2"
            />
          </svg>

          {/* Price labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground px-2">
            <span>${chartData.bids[chartData.bids.length - 1]?.price.toFixed(2)}</span>
            <span className="font-semibold">${midPrice.toFixed(2)}</span>
            <span>${chartData.asks[chartData.asks.length - 1]?.price.toFixed(2)}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-status-success/30 border border-status-success" />
            <span className="text-muted-foreground">Bids</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-status-error/30 border border-status-error" />
            <span className="text-muted-foreground">Asks</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

function createPath(
  data: { price: number; total: number }[],
  maxTotal: number,
  side: 'left' | 'right'
): string {
  if (data.length === 0) return '';

  const points = data.map((point, i) => {
    const x = side === 'left' ? 50 - (i / data.length) * 50 : 50 + (i / data.length) * 50;
    const y = 100 - (point.total / maxTotal) * 100;
    return `${x},${y}`;
  });

  const startX = side === 'left' ? 50 : 50;
  const path = [
    `M ${startX},100`,
    ...points.map(p => `L ${p}`),
    side === 'left' ? `L 0,100` : `L 100,100`,
    'Z',
  ].join(' ');

  return path;
}
