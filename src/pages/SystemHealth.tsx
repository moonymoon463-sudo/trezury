import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { productionHealthService, SystemHealth, HealthMetric } from '@/services/productionHealthService';
import { logger } from '@/utils/logger';

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [rpcStatus, setRpcStatus] = useState<any[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);

  useEffect(() => {
    loadHealthData();
    const interval = setInterval(loadHealthData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadHealthData = async () => {
    try {
      // Get system health metrics
      const systemHealth = await productionHealthService.getSystemHealth();
      setHealth(systemHealth);

      // Get recent alerts
      const { data: alerts } = await supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      setRecentAlerts(alerts || []);

      logger.info('System health data loaded', { 
        overall: systemHealth.overall,
        metricsCount: systemHealth.metrics.length 
      });
    } catch (error: any) {
      logger.error('Failed to load health data', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'degraded':
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="outline" className="bg-success/10 text-success">Healthy</Badge>;
      case 'degraded':
      case 'warning':
        return <Badge variant="outline" className="bg-warning/10 text-warning">Warning</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatMetricValue = (metric: HealthMetric) => {
    if (metric.name.includes('rate')) {
      return `${metric.value.toFixed(2)}%`;
    }
    if (metric.name.includes('time')) {
      return `${(metric.value / 1000).toFixed(2)}s`;
    }
    return metric.value.toFixed(2);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-muted-foreground">Real-time monitoring and metrics</p>
        </div>
        <Button onClick={loadHealthData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(health?.overall || 'unknown')}
              <div>
                <CardTitle>System Status</CardTitle>
                <CardDescription>
                  Last checked: {health?.lastCheck.toLocaleTimeString()}
                </CardDescription>
              </div>
            </div>
            {getStatusBadge(health?.overall || 'unknown')}
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="alerts">Recent Alerts</TabsTrigger>
          <TabsTrigger value="rpc">RPC Status</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          {health?.metrics.length === 0 ? (
            <Alert>
              <AlertDescription>
                No health metrics available. Metrics will appear as system operations are performed.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {health?.metrics.map((metric, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{metric.name}</CardTitle>
                      {getStatusIcon(metric.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Current</span>
                        <span className="font-mono font-semibold">
                          {formatMetricValue(metric)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Threshold</span>
                        <span className="font-mono">
                          {metric.name.includes('rate') ? `${metric.threshold}%` : 
                           metric.name.includes('time') ? `${(metric.threshold / 1000).toFixed(2)}s` :
                           metric.threshold.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        {getStatusBadge(metric.status)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {recentAlerts.length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                No recent alerts. System is operating normally.
              </AlertDescription>
            </Alert>
          ) : (
            recentAlerts.map((alert) => (
              <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{alert.title}</h4>
                      <Badge variant="outline">{alert.severity}</Badge>
                    </div>
                    <p className="text-sm">{alert.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Alert>
            ))
          )}
        </TabsContent>

        <TabsContent value="rpc">
          <Alert>
            <AlertDescription>
              RPC failover status will be displayed here when configured. 
              Add RPC provider API keys in the deployment checklist.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
