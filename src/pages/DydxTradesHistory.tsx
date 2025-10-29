import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDydxWallet } from '@/hooks/useDydxWallet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import AurumLogo from '@/components/AurumLogo';

interface DydxOrder {
  id: string;
  market: string;
  side: string;
  order_type: string;
  size: number;
  price: number;
  leverage: number;
  status: string;
  created_at: string;
  filled_at?: string;
  error_message?: string;
}

const DydxTradesHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dydxAddress } = useDydxWallet();
  const { toast } = useToast();
  const [orders, setOrders] = useState<DydxOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'filled' | 'cancelled'>('all');

  const loadOrders = async () => {
    if (!user || !dydxAddress) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('dydx_orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to Load Orders',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [user, dydxAddress]);

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status.toLowerCase() === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'filled':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'open':
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'filled':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'open':
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (!user || !dydxAddress) {
    return (
      <div className="min-h-screen bg-[#211d12] flex items-center justify-center p-4">
        <Card className="bg-[#2a251a] border-[#463c25] max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-white mb-4">Please connect your dYdX wallet to view trades</p>
            <Button
              onClick={() => navigate('/trading-dashboard')}
              className="bg-[#e6b951] hover:bg-[#d4a840] text-black font-bold"
            >
              Go to Trading Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#211d12] p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/trading-dashboard')}
            className="text-white hover:bg-[#463c25]"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex items-center gap-3">
            <AurumLogo className="h-12 w-12" />
            <div>
              <h1 className="text-2xl font-bold text-white">dYdX Trade History</h1>
              <p className="text-[#c6b795] text-sm">View all your trading activity</p>
            </div>
          </div>
          <Button
            onClick={loadOrders}
            variant="ghost"
            size="icon"
            className="ml-auto text-[#e6b951] hover:bg-[#463c25]"
            disabled={loading}
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'open', 'filled', 'cancelled'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f as typeof filter)}
              className={
                filter === f
                  ? 'bg-[#e6b951] text-black hover:bg-[#d4a840]'
                  : 'border-[#463c25] text-[#c6b795] hover:bg-[#463c25]'
              }
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="max-w-6xl mx-auto space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="bg-[#2a251a] border-[#463c25]">
              <CardContent className="p-4">
                <Skeleton className="h-20 bg-[#463c25]/50" />
              </CardContent>
            </Card>
          ))
        ) : filteredOrders.length === 0 ? (
          <Card className="bg-[#2a251a] border-[#463c25]">
            <CardContent className="p-8 text-center">
              <p className="text-[#c6b795] text-lg mb-2">No trades found</p>
              <p className="text-[#c6b795]/60 text-sm mb-4">
                {filter === 'all'
                  ? 'Start trading to see your order history here'
                  : `No ${filter} orders found`}
              </p>
              <Button
                onClick={() => navigate('/trading-dashboard')}
                className="bg-[#e6b951] hover:bg-[#d4a840] text-black font-bold"
              >
                Start Trading
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="bg-[#2a251a] border-[#463c25] hover:border-[#e6b951]/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Order Details */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={
                          order.side === 'BUY'
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }
                      >
                        {order.side === 'BUY' ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {order.side}
                      </Badge>
                      <span className="text-white font-bold text-lg">{order.market}</span>
                      <Badge variant="outline" className="border-[#463c25] text-[#c6b795]">
                        {order.order_type}
                      </Badge>
                      <Badge variant="outline" className="border-[#463c25] text-[#e6b951]">
                        {order.leverage}x
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-[#c6b795] text-xs">Size</p>
                        <p className="text-white font-semibold">{order.size}</p>
                      </div>
                      <div>
                        <p className="text-[#c6b795] text-xs">Price</p>
                        <p className="text-white font-semibold">${order.price.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[#c6b795] text-xs">Value</p>
                        <p className="text-white font-semibold">
                          ${(order.size * order.price).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#c6b795] text-xs">Created</p>
                        <p className="text-white font-semibold">
                          {new Date(order.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>

                    {order.error_message && (
                      <p className="text-red-400 text-xs">{order.error_message}</p>
                    )}
                  </div>

                  {/* Right: Status */}
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className={getStatusColor(order.status)}>
                      <span className="mr-1">{getStatusIcon(order.status)}</span>
                      {order.status.toUpperCase()}
                    </Badge>
                    {order.filled_at && (
                      <p className="text-[#c6b795] text-xs">
                        Filled {new Date(order.filled_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default DydxTradesHistory;
