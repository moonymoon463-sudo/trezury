import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity,
  ArrowLeft,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Monitor,
  RefreshCw,
  Server,
  Wifi,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SystemAnalyticsService } from '@/services/SystemAnalyticsService';
import { supabase } from '@/integrations/supabase/client';
import AurumLogo from '@/components/AurumLogo';

interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_io: number;
  database_connections: number;
  response_time: number;
  error_rate: number;
  uptime: number;
  active_users: number;
  requests_per_minute: number;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  response_time: number;
  last_check: string;
}

const RealTimeSystemMonitor = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadSystemMetrics = async () => {
    try {
      const data = await SystemAnalyticsService.getSystemMetrics();
      setMetrics(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load system metrics:', error);
    }
  };

  const loadServiceStatus = async () => {
    try {
      const data = await SystemAnalyticsService.getServiceStatus();
      setServices(data);
    } catch (error) {
      console.error('Failed to load service status:', error);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([loadSystemMetrics(), loadServiceStatus()]);
      setLoading(false);
    };

    initializeData();

    // Set up real-time updates
    const interval = setInterval(() => {
      loadSystemMetrics();
      loadServiceStatus();
    }, 5000); // Update every 5 seconds

    // Set up WebSocket for real-time updates
    const channel = supabase
      .channel('system-metrics')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'system_health_metrics'
      }, () => {
        loadSystemMetrics();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getProgressColor = (value: number, warning = 70, critical = 90) => {
    if (value >= critical) return 'bg-red-500';
    if (value >= warning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading system monitor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin')}
              className="text-foreground hover:bg-accent"
            >
              <ArrowLeft size={24} />
            </Button>
            <AurumLogo className="w-8 h-8" />
            <h1 className="text-xl font-bold text-foreground">System Monitor</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                loadSystemMetrics();
                loadServiceStatus();
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* System Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.cpu_usage?.toFixed(1) || 0}%</div>
              <Progress value={metrics?.cpu_usage || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.memory_usage?.toFixed(1) || 0}%</div>
              <Progress value={metrics?.memory_usage || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.active_users || 0}</div>
              <p className="text-xs text-muted-foreground">Currently online</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.response_time || 0}ms</div>
              <p className="text-xs text-muted-foreground">Average response</p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Disk Usage</span>
                  <span>{metrics?.disk_usage?.toFixed(1) || 0}%</span>
                </div>
                <Progress value={metrics?.disk_usage || 0} />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Network I/O</span>
                  <span>{metrics?.network_io?.toFixed(1) || 0} MB/s</span>
                </div>
                <Progress value={(metrics?.network_io || 0) * 10} />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Error Rate</span>
                  <span>{metrics?.error_rate?.toFixed(2) || 0}%</span>
                </div>
                <Progress value={metrics?.error_rate || 0} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div key={service.name} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {service.name === 'Database' && <Database className="h-4 w-4" />}
                      {service.name === 'API Gateway' && <Globe className="h-4 w-4" />}
                      {service.name === 'WebSocket' && <Wifi className="h-4 w-4" />}
                      {service.name === 'Background Jobs' && <Server className="h-4 w-4" />}
                      <span className="font-medium">{service.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{service.response_time}ms</span>
                    <Badge variant="default" className={getStatusColor(service.status)}>
                      {service.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uptime</span>
                  <span>{Math.floor((metrics?.uptime || 0) / 3600)}h {Math.floor(((metrics?.uptime || 0) % 3600) / 60)}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Database Connections</span>
                  <span>{metrics?.database_connections || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requests/min</span>
                  <span>{metrics?.requests_per_minute || 0}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform</span>
                  <span>Linux x64</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Node Version</span>
                  <span>v18.17.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memory Total</span>
                  <span>8.0 GB</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default RealTimeSystemMonitor;