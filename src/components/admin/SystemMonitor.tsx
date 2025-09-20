import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SystemHealth {
  database_status: 'healthy' | 'warning' | 'error';
  edge_functions_status: 'healthy' | 'warning' | 'error';
  fee_collection_status: 'healthy' | 'warning' | 'error';
  security_status: 'healthy' | 'warning' | 'error';
  last_check: string;
  issues: string[];
  metrics: {
    total_users: number;
    active_transactions: number;
    pending_fees: number;
    system_uptime: number;
  };
}

const SystemMonitor = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const checkSystemHealth = async () => {
    setLoading(true);
    try {
      const issues: string[] = [];
      
      // Check database connectivity
      const { data: dbTest, error: dbError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      const dbStatus = dbError ? 'error' : 'healthy';
      if (dbError) issues.push('Database connectivity issue');

      // Check fee collection system
      const { data: feeRequests } = await supabase
        .from('fee_collection_requests')
        .select('status')
        .eq('status', 'pending');
      
      const feeStatus = feeRequests && feeRequests.length > 50 ? 'warning' : 'healthy';
      if (feeRequests && feeRequests.length > 50) {
        issues.push(`${feeRequests.length} pending fee requests (consider processing)`);
      }

      // Check for edge function availability
      let edgeFunctionStatus: 'healthy' | 'warning' | 'error' = 'healthy';
      try {
        const response = await fetch('https://auntkvllzejtfqmousxg.supabase.co/functions/v1/fee-collection-api/health', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          }
        });
        if (!response.ok) {
          edgeFunctionStatus = 'warning';
          issues.push('Fee collection API not responding');
        }
      } catch {
        edgeFunctionStatus = 'error';
        issues.push('Edge functions unavailable');
      }

      // Security status check
      const securityStatus = issues.length > 0 ? 'warning' : 'healthy';

      // Get system metrics
      const { data: userCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' });

      const { data: activeTransactions } = await supabase
        .from('transactions')
        .select('id', { count: 'exact' })
        .eq('status', 'pending');

      const healthData: SystemHealth = {
        database_status: dbStatus,
        edge_functions_status: edgeFunctionStatus,
        fee_collection_status: feeStatus,
        security_status: securityStatus,
        last_check: new Date().toISOString(),
        issues,
        metrics: {
          total_users: userCount?.length || 0,
          active_transactions: activeTransactions?.length || 0,
          pending_fees: feeRequests?.length || 0,
          system_uptime: 99.9 // Mock uptime percentage
        }
      };

      setHealth(healthData);
      
      if (issues.length > 0) {
        toast({
          variant: "destructive",
          title: "System Issues Detected",
          description: `${issues.length} issue(s) found - check System Monitor`
        });
      } else {
        toast({
          title: "System Healthy",
          description: "All systems operational"
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Health Check Failed",
        description: "Unable to check system health"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSystemHealth();
    // Auto-refresh every 5 minutes
    const interval = setInterval(checkSystemHealth, 300000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
    }
  };

  if (!health && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={checkSystemHealth} className="w-full">
            <Activity className="h-4 w-4 mr-2" />
            Check System Health
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Monitor
          </CardTitle>
          <Button 
            onClick={checkSystemHealth} 
            disabled={loading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* System Status Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(health?.database_status || 'error')}
              <span className="text-sm font-medium">Database</span>
            </div>
            <Badge className={getStatusColor(health?.database_status || 'error')}>
              {health?.database_status?.toUpperCase()}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(health?.edge_functions_status || 'error')}
              <span className="text-sm font-medium">Edge Functions</span>
            </div>
            <Badge className={getStatusColor(health?.edge_functions_status || 'error')}>
              {health?.edge_functions_status?.toUpperCase()}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(health?.fee_collection_status || 'error')}
              <span className="text-sm font-medium">Fee Collection</span>
            </div>
            <Badge className={getStatusColor(health?.fee_collection_status || 'error')}>
              {health?.fee_collection_status?.toUpperCase()}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(health?.security_status || 'error')}
              <span className="text-sm font-medium">Security</span>
            </div>
            <Badge className={getStatusColor(health?.security_status || 'error')}>
              {health?.security_status?.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* System Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{health?.metrics.total_users}</div>
            <div className="text-xs text-muted-foreground">Total Users</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{health?.metrics.active_transactions}</div>
            <div className="text-xs text-muted-foreground">Active Transactions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{health?.metrics.pending_fees}</div>
            <div className="text-xs text-muted-foreground">Pending Fees</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{health?.metrics.system_uptime}%</div>
            <div className="text-xs text-muted-foreground">Uptime</div>
          </div>
        </div>

        {/* Issues List */}
        {health?.issues && health.issues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-yellow-700">System Issues:</h4>
            <ul className="space-y-1">
              {health.issues.map((issue, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Last Check */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last checked: {health?.last_check ? new Date(health.last_check).toLocaleString() : 'Never'}
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemMonitor;