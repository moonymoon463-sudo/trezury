import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Users, Activity, Database, Zap, TrendingUp } from 'lucide-react';
import { cachingService } from '@/services/cachingService';
import { rateLimitingService } from '@/services/rateLimitingService';
import { performanceMonitoringService } from '@/services/performanceMonitoringService';

interface SystemHealthData {
  active_users: number;
  total_users: number;
  total_transactions: number;
  avg_response_time_ms: number;
  system_load: 'low' | 'medium' | 'high';
  capacity_status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
}

export const ScalingDashboard = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [rateLimitStats, setRateLimitStats] = useState<any>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load system health
      const health = await performanceMonitoringService.getSystemHealth();
      setSystemHealth(health);

      // Load cache statistics
      const cache = cachingService.getStats();
      setCacheStats(cache);

      // Load rate limiting statistics
      const rateLimit = rateLimitingService.getStats();
      setRateLimitStats(rateLimit);

      // Load performance metrics
      const performance = performanceMonitoringService.getPerformanceSummary();
      setPerformanceMetrics(performance);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-success';
      case 'warning': return 'bg-warning';
      case 'critical': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  const getLoadColor = (load: string) => {
    switch (load) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const calculateCapacityPercentage = (activeUsers: number) => {
    return Math.min((activeUsers / 10000) * 100, 100); // 10k user target
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Scaling Dashboard</h1>
          <Badge variant="outline">Loading...</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scaling Dashboard</h1>
          <p className="text-muted-foreground">
            System performance and capacity monitoring for 10k+ users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={systemHealth ? getStatusColor(systemHealth.capacity_status) : ''}
          >
            {systemHealth?.capacity_status || 'Unknown'}
          </Badge>
          <Button onClick={loadDashboardData} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemHealth?.active_users?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              of {systemHealth?.total_users?.toLocaleString() || '0'} total users
            </p>
            <Progress 
              value={calculateCapacityPercentage(systemHealth?.active_users || 0)} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemHealth?.avg_response_time_ms?.toFixed(0) || '0'}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Average API response time
            </p>
            <Progress 
              value={Math.min((systemHealth?.avg_response_time_ms || 0) / 10, 100)} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Load</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getLoadColor(systemHealth?.system_load || 'low')}`}>
              {systemHealth?.system_load?.toUpperCase() || 'LOW'}
            </div>
            <p className="text-xs text-muted-foreground">
              Current system load level
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((cacheStats?.hitRate || 0) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {cacheStats?.hits || 0} hits, {cacheStats?.misses || 0} misses
            </p>
            <Progress 
              value={(cacheStats?.hitRate || 0) * 100} 
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="caching">Caching</TabsTrigger>
          <TabsTrigger value="ratelimiting">Rate Limiting</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>System performance over the last 5 minutes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceMetrics?.metrics && Object.entries(performanceMetrics.metrics).map(([name, stats]: [string, any]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{name}</span>
                      <div className="text-right">
                        <div className="text-sm font-mono">
                          Avg: {stats.avg?.toFixed(2)} | Max: {stats.max?.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {stats.count} samples
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Capacity Planning</CardTitle>
                <CardDescription>Usage trends and projections</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Current Capacity</span>
                    <span className="text-sm font-mono">
                      {calculateCapacityPercentage(systemHealth?.active_users || 0).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={calculateCapacityPercentage(systemHealth?.active_users || 0)} />
                  
                  <div className="text-xs text-muted-foreground">
                    Target: 10,000 concurrent users
                    <br />
                    Current: {systemHealth?.active_users || 0} active users
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="caching" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cache Performance</CardTitle>
              <CardDescription>Caching statistics and hit rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-success">
                    {cacheStats?.hits || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Cache Hits</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-destructive">
                    {cacheStats?.misses || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Cache Misses</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-warning">
                    {cacheStats?.evictions || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Evictions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {cacheStats?.size || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Cache Size</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ratelimiting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limiting</CardTitle>
              <CardDescription>Request throttling and user tiers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Rate Limit Buckets</span>
                  <span className="text-sm font-mono">{rateLimitStats?.totalBuckets || 0}</span>
                </div>
                
                {rateLimitStats?.bucketsPerTier && Object.entries(rateLimitStats.bucketsPerTier).map(([tier, count]: [string, any]) => (
                  <div key={tier} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{tier} Tier</span>
                    <Badge variant="outline">{count} users</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
              <CardDescription>Recent performance alerts and warnings</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceMetrics?.alerts && performanceMetrics.alerts.length > 0 ? (
                <div className="space-y-3">
                  {performanceMetrics.alerts.map((alert: any, index: number) => (
                    <div 
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        alert.type === 'critical' ? 'border-destructive bg-destructive/5' : 'border-warning bg-warning/5'
                      }`}
                    >
                      <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                        alert.type === 'critical' ? 'text-destructive' : 'text-warning'
                      }`} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{alert.message}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <Badge variant={alert.type === 'critical' ? 'destructive' : 'outline'}>
                        {alert.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2" />
                  <p>No active alerts - system is running smoothly!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};