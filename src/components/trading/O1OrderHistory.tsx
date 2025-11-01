import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Mock order history
const mockOrders = [
  {
    id: '1',
    market: 'SOL-PERP',
    side: 'long' as const,
    type: 'market' as const,
    size: 10,
    price: 180,
    status: 'filled' as const,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    market: 'BTC-PERP',
    side: 'short' as const,
    type: 'limit' as const,
    size: 0.5,
    price: 97000,
    status: 'cancelled' as const,
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
];

export const O1OrderHistory = () => {
  const orders = mockOrders;

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-muted-foreground text-sm">No order history</p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Your completed orders will appear here
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        {orders.map((order) => {
          const date = new Date(order.timestamp);
          const timeAgo = Math.floor((Date.now() - date.getTime()) / 60000); // minutes ago

          return (
            <Card
              key={order.id}
              className="bg-card/50 border-border/40 hover:bg-card/60 transition-colors"
            >
              <div className="p-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {order.market}
                    </span>
                    <Badge
                      variant={order.side === 'long' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {order.side.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">
                      {order.type}
                    </Badge>
                  </div>
                  <Badge
                    variant={
                      order.status === 'filled'
                        ? 'default'
                        : order.status === 'cancelled'
                        ? 'secondary'
                        : 'outline'
                    }
                    className="text-xs capitalize"
                  >
                    {order.status}
                  </Badge>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Size: </span>
                    <span className="text-foreground font-medium">{order.size}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Price: </span>
                    <span className="text-foreground font-medium">${order.price}</span>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="mt-2 text-xs text-muted-foreground">
                  {timeAgo < 60
                    ? `${timeAgo}m ago`
                    : timeAgo < 1440
                    ? `${Math.floor(timeAgo / 60)}h ago`
                    : `${Math.floor(timeAgo / 1440)}d ago`}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
};
