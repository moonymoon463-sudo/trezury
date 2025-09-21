import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Target, Clock, CheckCircle, XCircle } from 'lucide-react';

interface LimitOrder {
  id: string;
  type: 'supply' | 'borrow' | 'withdraw' | 'repay';
  asset: string;
  amount: number;
  targetRate: number;
  currentRate: number;
  status: 'active' | 'filled' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export function LimitOrderManager() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<LimitOrder[]>([
    {
      id: '1',
      type: 'supply',
      asset: 'USDC',
      amount: 10000,
      targetRate: 8.5,
      currentRate: 7.2,
      status: 'active',
      createdAt: '2024-01-15',
      expiresAt: '2024-02-15'
    },
    {
      id: '2',
      type: 'borrow',
      asset: 'ETH',
      amount: 5,
      targetRate: 3.0,
      currentRate: 4.1,
      status: 'active',
      createdAt: '2024-01-14',
      expiresAt: '2024-02-14'
    }
  ]);

  const [newOrder, setNewOrder] = useState({
    type: 'supply' as const,
    asset: 'USDC',
    amount: '',
    targetRate: '',
    duration: '30'
  });

  const cancelOrder = (orderId: string) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { ...order, status: 'cancelled' as const }
        : order
    ));
    
    toast({
      title: "Order Cancelled",
      description: "Limit order has been cancelled",
    });
  };

  const createOrder = () => {
    if (!newOrder.amount || !newOrder.targetRate) {
      toast({
        variant: "destructive",
        title: "Invalid Order",
        description: "Please fill in all required fields",
      });
      return;
    }

    const order: LimitOrder = {
      id: Date.now().toString(),
      type: newOrder.type,
      asset: newOrder.asset,
      amount: parseFloat(newOrder.amount),
      targetRate: parseFloat(newOrder.targetRate),
      currentRate: getCurrentRate(newOrder.asset, newOrder.type),
      status: 'active',
      createdAt: new Date().toLocaleDateString(),
      expiresAt: new Date(Date.now() + parseInt(newOrder.duration) * 24 * 60 * 60 * 1000).toLocaleDateString()
    };

    setOrders(prev => [...prev, order]);
    setNewOrder({
      type: 'supply',
      asset: 'USDC',
      amount: '',
      targetRate: '',
      duration: '30'
    });

    toast({
      title: "Order Created",
      description: `Limit order for ${order.amount} ${order.asset} has been created`,
    });
  };

  const getCurrentRate = (asset: string, type: string): number => {
    // Mock current rates
    const rates: Record<string, Record<string, number>> = {
      USDC: { supply: 7.2, borrow: 8.5 },
      ETH: { supply: 5.8, borrow: 4.1 },
      WBTC: { supply: 4.5, borrow: 5.2 },
      DAI: { supply: 6.9, borrow: 7.8 }
    };
    return rates[asset]?.[type] || 0;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'filled': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'expired': return <XCircle className="w-4 h-4 text-gray-400" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-yellow-500/20 text-yellow-400';
      case 'filled': return 'bg-green-500/20 text-green-400';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      case 'expired': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Target className="w-5 h-5 text-primary" />
            Active Limit Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {orders.filter(order => order.status === 'active').length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No active limit orders</p>
              <p className="text-sm">Create a limit order to automatically execute trades at your target rates</p>
            </div>
          ) : (
            orders.filter(order => order.status === 'active').map((order) => (
              <Card key={order.id} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {order.type}
                      </Badge>
                      <span className="text-white font-medium">
                        {order.amount.toLocaleString()} {order.asset}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(order.status)}
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <div className="text-gray-400">Target Rate</div>
                      <div className="text-white font-medium">
                        {order.targetRate.toFixed(2)}% APY
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Current Rate</div>
                      <div className="text-white">
                        {order.currentRate.toFixed(2)}% APY
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Created</div>
                      <div className="text-white">{order.createdAt}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Expires</div>
                      <div className="text-white">{order.expiresAt}</div>
                    </div>
                  </div>
                  
                  {order.status === 'active' && (
                    <Button
                      onClick={() => cancelOrder(order.id)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Cancel Order
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Create Limit Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="orderType" className="text-gray-300">Order Type</Label>
              <select
                id="orderType"
                value={newOrder.type}
                onChange={(e) => setNewOrder(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white"
              >
                <option value="supply">Supply</option>
                <option value="borrow">Borrow</option>
                <option value="withdraw">Withdraw</option>
                <option value="repay">Repay</option>
              </select>
            </div>
            <div>
              <Label htmlFor="orderAsset" className="text-gray-300">Asset</Label>
              <select
                id="orderAsset"
                value={newOrder.asset}
                onChange={(e) => setNewOrder(prev => ({ ...prev, asset: e.target.value }))}
                className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white"
              >
                <option value="USDC">USDC</option>
                <option value="ETH">ETH</option>
                <option value="WBTC">WBTC</option>
                <option value="DAI">DAI</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount" className="text-gray-300">Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={newOrder.amount}
                onChange={(e) => setNewOrder(prev => ({ ...prev, amount: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label htmlFor="targetRate" className="text-gray-300">Target Rate (%)</Label>
              <Input
                id="targetRate"
                type="number"
                step="0.1"
                placeholder="Enter target APY"
                value={newOrder.targetRate}
                onChange={(e) => setNewOrder(prev => ({ ...prev, targetRate: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="duration" className="text-gray-300">Duration (days)</Label>
            <Input
              id="duration"
              type="number"
              value={newOrder.duration}
              onChange={(e) => setNewOrder(prev => ({ ...prev, duration: e.target.value }))}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          
          <div className="p-3 bg-gray-800 rounded-lg text-sm">
            <div className="text-gray-400">Current Rate:</div>
            <div className="text-white font-medium">
              {getCurrentRate(newOrder.asset, newOrder.type).toFixed(2)}% APY
            </div>
          </div>
          
          <Button
            onClick={createOrder}
            disabled={!newOrder.amount || !newOrder.targetRate}
            className="w-full bg-primary hover:bg-primary/90"
          >
            Create Limit Order
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}