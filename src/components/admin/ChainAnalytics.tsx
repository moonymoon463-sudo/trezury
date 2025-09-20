import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle,
  Clock,
  DollarSign 
} from 'lucide-react';

interface ChainAnalytics {
  [chain: string]: {
    collected: number;
    pending: number;
    failed: number;
    total_requests: number;
    success_rate: number;
  };
}

interface ChainAnalyticsProps {
  chainAnalytics: ChainAnalytics;
  chainBreakdown: any;
}

const ChainAnalytics: React.FC<ChainAnalyticsProps> = ({ 
  chainAnalytics, 
  chainBreakdown 
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getChainDisplayName = (chain: string) => {
    const names: Record<string, string> = {
      ethereum: 'Ethereum',
      base: 'Base',
      solana: 'Solana',
      tron: 'Tron'
    };
    return names[chain] || chain.charAt(0).toUpperCase() + chain.slice(1);
  };

  const getStatusColor = (successRate: number) => {
    if (successRate >= 90) return 'text-green-600';
    if (successRate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const chains = Object.keys(chainAnalytics || {});

  if (chains.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Chain-Specific Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No chain-specific data available yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Chain-Specific Fee Collection Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chains.map((chain) => {
              const analytics = chainAnalytics[chain];
              const breakdown = chainBreakdown?.[chain];
              
              return (
                <Card key={chain} className="border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      {getChainDisplayName(chain)}
                      <Badge 
                        variant={analytics.success_rate >= 90 ? "default" : analytics.success_rate >= 70 ? "secondary" : "destructive"}
                      >
                        {analytics.success_rate.toFixed(1)}% Success
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Collection Summary */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(analytics.collected)}
                        </div>
                        <div className="text-xs text-muted-foreground">Collected</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-600">
                          {formatCurrency(analytics.pending)}
                        </div>
                        <div className="text-xs text-muted-foreground">Pending</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(analytics.failed)}
                        </div>
                        <div className="text-xs text-muted-foreground">Failed</div>
                      </div>
                    </div>

                    {/* Success Rate Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Success Rate</span>
                        <span className={getStatusColor(analytics.success_rate)}>
                          {analytics.success_rate.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={analytics.success_rate} 
                        className="h-2"
                      />
                    </div>

                    {/* Request Statistics */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Requests</span>
                      <span className="font-semibold">{analytics.total_requests}</span>
                    </div>

                    {/* Status Indicators */}
                    <div className="flex items-center gap-4 text-xs">
                      {analytics.success_rate >= 90 && (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          Healthy
                        </div>
                      )}
                      {analytics.success_rate < 90 && analytics.success_rate >= 70 && (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <Clock className="h-3 w-3" />
                          Needs Attention
                        </div>
                      )}
                      {analytics.success_rate < 70 && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="h-3 w-3" />
                          Critical
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Chain Summary Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Chain Collection Summary (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(chainBreakdown || {}).map(([chain, data]: [string, any]) => (
              <div key={chain} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="font-medium">{getChainDisplayName(chain)}</div>
                  <Badge variant="outline">{data.count} requests</Badge>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatCurrency(data.collected)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(data.pending)} pending
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChainAnalytics;