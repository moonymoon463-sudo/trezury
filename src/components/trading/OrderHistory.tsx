import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { snxTradingService } from '@/services/snxTradingService';
import type { SnxOrder } from '@/types/snx';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const OrderHistory = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<SnxOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadOrders = async () => {
      try {
        setLoading(true);
        const data = await snxTradingService.getOrderHistory(user.id);
        setOrders(data);
      } catch (error) {
        console.error('[OrderHistory] Failed to load:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [user]);

  const openOrders = orders.filter(o => o.status === 'PENDING');
  const completedOrders = orders.filter(o => o.status === 'FILLED');
  const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FILLED':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Filled</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      case 'PENDING':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const OrderRow = ({ order }: { order: SnxOrder }) => (
    <div className="border border-border rounded-lg p-3 mb-2">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{order.marketKey}</span>
            <Badge variant={order.side === 'BUY' ? 'default' : 'destructive'}>{order.side}</Badge>
            {getStatusBadge(order.status)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Size:</span>
          <span className="ml-2 font-medium">{order.size}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Leverage:</span>
          <span className="ml-2 font-medium">{order.leverage}×</span>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order History</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="open">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="open">Open ({openOrders.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedOrders.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({cancelledOrders.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="open">
            {openOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No open orders</p>
            ) : (
              openOrders.map(order => <OrderRow key={order.id} order={order} />)
            )}
          </TabsContent>
          <TabsContent value="completed">
            {completedOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No completed orders</p>
            ) : (
              completedOrders.map(order => <OrderRow key={order.id} order={order} />)
            )}
          </TabsContent>
          <TabsContent value="cancelled">
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
