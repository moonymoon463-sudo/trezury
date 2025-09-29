import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StandardHeader from '@/components/StandardHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { useTransactionTracker } from '@/hooks/useTransactionTracker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpIcon, ArrowDownIcon, RefreshCwIcon, DollarSignIcon, SendIcon, DownloadIcon, UploadIcon } from 'lucide-react';

const Transactions = () => {
  const navigate = useNavigate();
  const { activities, loading, error, getActivityIcon, getActivityDescription } = useTransactionTracker();
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredActivities = activities.filter(activity => {
    if (activeFilter === 'all') return true;
    return activity.type === activeFilter;
  });

  const getReactIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'buy':
        return <ArrowDownIcon className="h-4 w-4 text-green-500" />;
      case 'sell':
        return <ArrowUpIcon className="h-4 w-4 text-red-500" />;
      case 'swap':
        return <RefreshCwIcon className="h-4 w-4 text-blue-500" />;
      case 'send':
        return <SendIcon className="h-4 w-4 text-orange-500" />;
      case 'receive':
        return <DownloadIcon className="h-4 w-4 text-green-500" />;
      case 'deposit':
        return <DownloadIcon className="h-4 w-4 text-blue-500" />;
      case 'withdrawal':
        return <UploadIcon className="h-4 w-4 text-orange-500" />;
      default:
        return <DollarSignIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatAmount = (activity: any) => {
    const amount = activity.quantity || 0;
    return `${amount.toFixed(activity.asset === 'USDC' ? 2 : 6)} ${activity.asset}`;
  };

  const formatValue = (activity: any) => {
    if (activity.unit_price_usd && activity.quantity) {
      const value = activity.unit_price_usd * activity.quantity;
      return `$${value.toFixed(2)}`;
    }
    return '-';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceBadge = (activity: any) => {
    if (activity.metadata?.provider === 'moonpay') {
      return <Badge variant="secondary" className="text-xs">MoonPay</Badge>;
    }
    if (activity.metadata?.transaction_source === 'external_wallet') {
      return <Badge variant="outline" className="text-xs">External</Badge>;
    }
    if (activity.activity_type === 'payment') {
      return <Badge variant="secondary" className="text-xs">Payment</Badge>;
    }
    return null;
  };

  const handleActivityClick = (activity: any) => {
    if (activity.activity_type === 'transaction') {
      navigate(`/transaction/${activity.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <StandardHeader />
        <div className="p-4">
          <div className="flex justify-center items-center h-64">
            <div className="text-muted-foreground">Loading activity...</div>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <StandardHeader />
        <div className="p-4">
          <div className="flex justify-center items-center h-64">
            <div className="text-destructive">Error loading activity: {error}</div>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col bg-background">
      <StandardHeader />
      
      <div className="flex-1 overflow-y-auto px-3 md:px-4 pt-[calc(3.5rem+max(8px,env(safe-area-inset-top))+0.5rem)] pb-[calc(var(--bottom-nav-height,56px)+env(safe-area-inset-bottom)+0.5rem)] space-y-4">
        {/* Filter buttons */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['all', 'buy', 'sell', 'swap', 'send', 'receive', 'deposit', 'withdrawal'].map((filter) => (
            <Button
              key={filter}
              variant={activeFilter === filter ? "default" : "outline"}
              size="sm"
              className="whitespace-nowrap capitalize"
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>

        {/* Activities list */}
        <div className="space-y-3">
          {filteredActivities.length === 0 ? (
            <Card className="p-6 text-center">
              <div className="text-muted-foreground">
                {activeFilter === 'all' 
                  ? "No activity found"
                  : `No ${activeFilter} activity found`
                }
              </div>
            </Card>
          ) : (
            filteredActivities.map((activity) => (
              <Card 
                key={`${activity.activity_type}-${activity.id}`}
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleActivityClick(activity)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getReactIcon(activity.type)}
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <span className="capitalize">{activity.type}</span>
                        {getSourceBadge(activity)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getActivityDescription(activity)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-medium">
                      {formatValue(activity)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatTimestamp(activity.timestamp)}
                    </div>
                  </div>
                </div>
                
                <div className="mt-2 flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    {formatAmount(activity)}
                  </span>
                  {activity.status && (
                    <Badge className={getStatusColor(activity.status)}>
                      {activity.status}
                    </Badge>
                  )}
                </div>

                {activity.tx_hash && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-mono">
                      {activity.tx_hash.slice(0, 10)}...{activity.tx_hash.slice(-8)}
                    </span>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
      
      <BottomNavigation />
    </div>
  );
};

export default Transactions;