import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity,
  AlertTriangle,
  ArrowLeft,
  Shield,
  Cpu,
  Database,
  RefreshCw,
  TrendingUp,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SystemAnalyticsService } from '@/services/SystemAnalyticsService';
import { supabaseHealthMonitor } from '@/services/supabaseHealthMonitor';
import { resourceMonitoringService } from '@/services/resourceMonitoringService';
import { performanceMonitoringService } from '@/services/performanceMonitoringService';
import { supabase } from '@/integrations/supabase/client';
import AurumLogo from '@/components/AurumLogo';
import { useSupabaseHealth } from '@/hooks/useSupabaseHealth';

const MonitoringDashboard = () => {
  const navigate = useNavigate();
  const { status: supabaseStatus, isHealthy, isDegraded, isUnhealthy } = useSupabaseHealth();
  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [resourceStatus, setResourceStatus] = useState<any>(null);
  const [performanceSummary, setPerformanceSummary] = useState<any>(null);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadAllMetrics = async () => {
    try {
      const [metrics, resources, performance] = await Promise.all([
        SystemAnalyticsService.getSystemMetrics(),
        resourceMonitoringService.getResourceStatus(),
        performanceMonitoringService.getPerformanceSummary()
      ]);
      
      setSystemMetrics(metrics);
      setResourceStatus(resources);
      setPerformanceSummary(performance);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const loadSecurityAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!error && data) {
        setSecurityAlerts(data);
      }
    } catch (error) {
      console.error('Failed to load security alerts:', error);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([loadAllMetrics(), loadSecurityAlerts()]);
      setLoading(false);
    };

    initializeData();

    const interval = setInterval(() => {
      loadAllMetrics();
      loadSecurityAlerts();
    }, 10000);

    const channel = supabase
      .channel('monitoring-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'security_alerts'
      }, () => {
        loadSecurityAlerts();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getHealthStatusColor = () => {
    if (isUnhealthy) return 'bg-red-500';
    if (isDegraded) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft size={24} />
            </Button>
            <AurumLogo className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">System Monitoring Dashboard</h1>
              <p className="text-sm text-muted-foreground">Real-time system health and performance</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="w-4 h-4" />
              <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                loadAllMetrics();
                loadSecurityAlerts();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getHealthStatusColor()}`} />
                <div className="text-2xl font-bold capitalize">{supabaseStatus}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Supabase connection status</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resourceStatus?.metrics?.cpu?.toFixed(1) || 0}%</div>
              <Progress value={resourceStatus?.metrics?.cpu || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {securityAlerts.filter(a => !a.resolved).length}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Unresolved alerts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {performanceSummary?.metrics?.api_response_time_ms?.avg?.toFixed(0) || 0}ms
              </div>
              <p className="text-xs text-muted-foreground mt-2">Average response</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Monitoring Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Overall Health</span>
                    <Badge className={getHealthStatusColor()}>
                      {resourceStatus?.systemHealth || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>CPU Usage</span>
                      <span>{resourceStatus?.metrics?.cpu?.toFixed(1) || 0}%</span>
                    </div>
                    <Progress value={resourceStatus?.metrics?.cpu || 0} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Memory Usage</span>
                      <span>{resourceStatus?.metrics?.memory?.toFixed(1) || 0}%</span>
                    </div>
                    <Progress value={resourceStatus?.metrics?.memory || 0} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Security Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {securityAlerts.slice(0, 5).map((alert) => (
                      <div key={alert.id} className="flex items-start gap-3 p-2 rounded-lg border">
                        <AlertTriangle className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{alert.title}</p>
                            <Badge className={getSeverityColor(alert.severity)} variant="secondary">
                              {alert.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(alert.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {securityAlerts.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No recent alerts</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(performanceSummary?.metrics || {}).map(([key, value]: [string, any]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{key.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Avg</p>
                          <p className="font-medium">{value.avg?.toFixed(2) || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Max</p>
                          <p className="font-medium">{value.max?.toFixed(2) || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Count</p>
                          <p className="font-medium">{value.count || 0}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {securityAlerts.map((alert) => (
                    <div key={alert.id} className="p-4 rounded-lg border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{alert.title}</h4>
                          <Badge className={getSeverityColor(alert.severity)} variant="secondary">
                            {alert.severity}
                          </Badge>
                        </div>
                        {alert.resolved && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{new Date(alert.created_at).toLocaleString()}</span>
                        <span>Type: {alert.alert_type}</span>
                      </div>
                    </div>
                  ))}
                  {securityAlerts.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No security alerts</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Resource Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>CPU Usage</span>
                      <span>{resourceStatus?.metrics?.cpu?.toFixed(1) || 0}%</span>
                    </div>
                    <Progress value={resourceStatus?.metrics?.cpu || 0} />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Memory Usage</span>
                      <span>{resourceStatus?.metrics?.memory?.toFixed(1) || 0}%</span>
                    </div>
                    <Progress value={resourceStatus?.metrics?.memory || 0} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Network I/O</span>
                      <span>{resourceStatus?.metrics?.network?.sent?.toFixed(2) || 0} MB/s</span>
                    </div>
                    <Progress value={(resourceStatus?.metrics?.network?.sent || 0) * 10} />
                  </div>

                  {resourceStatus?.recentAlerts && resourceStatus.recentAlerts.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-semibold mb-3">Recent Resource Alerts</h4>
                      <div className="space-y-2">
                        {resourceStatus.recentAlerts.map((alert: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-lg border bg-muted/50">
                            <div className="flex items-center gap-2">
                              <Badge className={getSeverityColor(alert.severity)} variant="secondary">
                                {alert.type}
                              </Badge>
                              <p className="text-sm">{alert.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MonitoringDashboard;
