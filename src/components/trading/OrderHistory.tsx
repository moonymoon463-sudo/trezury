import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { HyperliquidOrderDB } from '@/types/hyperliquid';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTradingPasswordContext } from '@/contexts/TradingPasswordContext';
import { useToast } from '@/hooks/use-toast';

interface OrderHistoryProps {
  address?: string;
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ address }) => {
  const [orders, setOrders] = useState<HyperliquidOrderDB[]>([]);
  const [loading, setLoading] = useState(false);
  const { getPassword } = useTradingPasswordContext();
  const { toast } = useToast();

  useEffect(() => {
    if (!address) return;

    const loadOrders = async () => {
      setLoading(true);
      try {
        // TODO: Implement Hyperliquid order history fetching
        const data: HyperliquidOrderDB[] = [];
        setOrders(data);
      } catch (error) {
        console.error('[OrderHistory] Failed to load:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [address]);

  const openOrders = orders.filter(o => o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED');
  const completedOrders = orders.filter(o => o.status === 'FILLED');
  const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');

  const getStatusBadge = (status: HyperliquidOrderDB['status']) => {
    const variants: Record<HyperliquidOrderDB['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
      PENDING: 'outline',
      OPEN: 'default',
      FILLED: 'secondary',
      PARTIALLY_FILLED: 'outline',
      CANCELLED: 'destructive',
      FAILED: 'destructive'
    };

    const icons = {
      PENDING: <Clock className="h-3 w-3 mr-1" />,
      OPEN: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
      FILLED: <CheckCircle className="h-3 w-3 mr-1" />,
      PARTIALLY_FILLED: <Loader2 className="h-3 w-3 mr-1" />,
      CANCELLED: <XCircle className="h-3 w-3 mr-1" />,
      FAILED: <XCircle className="h-3 w-3 mr-1" />
    };

    return (
      <Badge variant={variants[status]} className="flex items-center w-fit">
        {icons[status]}
        {status}
      </Badge>
    );
  };

  const OrderRow = ({ order }: { order: HyperliquidOrderDB }) => (
    <div className="border border-border rounded-lg p-4 mb-2 hover:bg-accent/50 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-foreground">{order.market}</span>
            <Badge variant={order.side === 'BUY' ? 'default' : 'destructive'}>
              {order.side}
            </Badge>
            <Badge variant="outline">{order.order_type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </p>
        </div>
        {getStatusBadge(order.status)}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Size:</span>
          <span className="ml-1 font-medium text-foreground">{order.size}</span>
        </div>
        {order.price && (
          <div>
            <span className="text-muted-foreground">Price:</span>
            <span className="ml-1 font-medium text-foreground">${order.price.toFixed(2)}</span>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Leverage:</span>
          <span className="ml-1 font-medium text-foreground">{order.leverage}x</span>
        </div>
        {order.filled_size > 0 && (
          <div>
            <span className="text-muted-foreground">Filled:</span>
            <span className="ml-1 font-medium text-foreground">
              {((order.filled_size / order.size) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {order.status === 'OPEN' && (
        <div className="mt-3">
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              const password = getPassword();
              if (!password) {
                toast({
                  variant: 'destructive',
                  title: 'Session Locked',
                  description: 'Please unlock your trading session first'
                });
                return;
              }
              // TODO: Implement Hyperliquid order cancellation
              toast({
                variant: 'destructive',
                title: 'Not Implemented',
                description: 'Hyperliquid order cancellation coming soon'
              });
            }}
          >
            Cancel Order
          </Button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Order History</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="open">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="open">
              Open ({openOrders.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelled ({cancelledOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-2 mt-4">
            {openOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No open orders</p>
            ) : (
              openOrders.map(order => <OrderRow key={order.id} order={order} />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-2 mt-4">
            {completedOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No completed orders</p>
            ) : (
              completedOrders.map(order => <OrderRow key={order.id} order={order} />)
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-2 mt-4">
            {cancelledOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No cancelled orders</p>
            ) : (
              cancelledOrders.map(order => <OrderRow key={order.id} order={order} />)
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};