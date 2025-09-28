import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
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
        return <ArrowDownIcon className="h-4 w-4 text-status-success" />;
      case 'sell':
        return <ArrowUpIcon className="h-4 w-4 text-status-error" />;
      case 'swap':
        return <RefreshCwIcon className="h-4 w-4 text-status-info" />;
      case 'send':
        return <SendIcon className="h-4 w-4 text-status-warning" />;
      case 'receive':
        return <DownloadIcon className="h-4 w-4 text-status-success" />;
      case 'deposit':
        return <DownloadIcon className="h-4 w-4 text-status-info" />;
      case 'withdrawal':
        return <UploadIcon className="h-4 w-4 text-status-warning" />;
      default:
        return <DollarSignIcon className="h-4 w-4 text-muted-foreground" />;
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
      case 'completed': return 'bg-status-success/10 text-status-success border-status-success/20';
      case 'pending': return 'bg-status-warning/10 text-status-warning border-status-warning/20';
      case 'failed': return 'bg-status-error/10 text-status-error border-status-error/20';
      default: return 'bg-muted text-muted-foreground';
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
      <AppLayout 
        headerProps={{ title: "Transactions" }}
        className="flex items-center justify-center"
      >
        <div className="text-muted-foreground">Loading activity...</div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout 
        headerProps={{ title: "Transactions" }}
        className="flex items-center justify-center"
      >
        <div className="text-status-error">Error loading activity: {error}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      headerProps={{ title: "Transactions" }}
      className="space-y-4"
    >
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
              className="p-4 cursor-pointer hover:bg-surface-elevated/50 transition-colors duration-200 border-border/50"
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
    </AppLayout>
  );
};

export default Transactions;