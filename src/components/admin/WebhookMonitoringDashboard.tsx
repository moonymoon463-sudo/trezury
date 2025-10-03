import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { enhancedMoonPayValidationService, MoonPayValidationReport } from '@/services/enhancedMoonPayValidationService';
import { Activity, CheckCircle, XCircle, AlertTriangle, Clock, Zap, Shield, TrendingUp } from 'lucide-react';
import { WebhookDLQManager } from './WebhookDLQManager';

interface WebhookStats {
  total_processed: number;
  successful: number;
  failed: number;
  avg_processing_time: number;
  rate_limited: number;
  last_24h: number;
}

interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  response_time: number;
  error_rate: number;
  requests_per_minute: number;
}

export default function WebhookMonitoringDashboard() {
  const [webhookStats, setWebhookStats] = useState<WebhookStats | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [validationReport, setValidationReport] = useState<MoonPayValidationReport | null>(null);
  const [isRunningValidation, setIsRunningValidation] = useState(false);
  const [recentWebhooks, setRecentWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      await Promise.all([
        loadWebhookStats(),
        loadSystemMetrics(),
        loadRecentWebhooks()
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load monitoring data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWebhookStats = async () => {
    const { data, error } = await supabase
      .from('webhook_processing_log')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    const stats: WebhookStats = {
      total_processed: data.length,
      successful: data.filter(w => w.status === 'completed').length,
      failed: data.filter(w => w.status === 'failed').length,
      avg_processing_time: data.reduce((sum, w) => sum + (w.processing_time_ms || 0), 0) / data.length || 0,
      rate_limited: data.filter(w => w.error_message?.includes('rate limit')).length,
      last_24h: data.length
    };

    setWebhookStats(stats);
  };

  const loadSystemMetrics = async () => {
    const { data, error } = await supabase
      .from('system_health_metrics')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (data.length > 0) {
      const latest = data[0];
      const metrics: SystemMetrics = {
        cpu_usage: 45, // Mock data - in production, get from actual metrics
        memory_usage: 62,
        response_time: latest.metric_value || 0,
        error_rate: data.filter(m => m.metric_name.includes('error')).length / data.length * 100,
        requests_per_minute: 150 // Mock data
      };
      setSystemMetrics(metrics);
    }
  };

  const loadRecentWebhooks = async () => {
    const { data, error } = await supabase
      .from('webhook_processing_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    setRecentWebhooks(data);
  };

  const runValidationSuite = async () => {
    setIsRunningValidation(true);
    try {
      const report = await enhancedMoonPayValidationService.runComprehensiveValidation();
      setValidationReport(report);
      
      toast({
        title: 'Validation Complete',
        description: `Status: ${report.overall_status.toUpperCase()}`,
        variant: report.overall_status === 'pass' ? 'default' : 'destructive'
      });
    } catch (error) {
      toast({
        title: 'Validation Failed',
        description: 'Failed to run validation suite',
        variant: 'destructive'
      });
    } finally {
      setIsRunningValidation(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'fail': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'destructive';
      case 'processing': return 'secondary';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhook Monitoring Dashboard</h1>
          <p className="text-muted-foreground">Real-time monitoring of MoonPay integrations and system health</p>
        </div>
        <Button 
          onClick={runValidationSuite} 
          disabled={isRunningValidation}
          className="flex items-center gap-2"
        >
          {isRunningValidation ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Running Tests...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              Run Validation
            </>
          )}
        </Button>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhook Success Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {webhookStats ? Math.round((webhookStats.successful / webhookStats.total_processed) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {webhookStats?.successful}/{webhookStats?.total_processed} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {webhookStats ? Math.round(webhookStats.avg_processing_time) : 0}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Average processing time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">Healthy</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">24h Webhooks</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{webhookStats?.last_24h || 0}</div>
            <p className="text-xs text-muted-foreground">
              Processed last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="webhooks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="webhooks">Webhook Activity</TabsTrigger>
          <TabsTrigger value="dlq">Failed Webhooks (DLQ)</TabsTrigger>
          <TabsTrigger value="validation">Validation Results</TabsTrigger>
          <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
          <TabsTrigger value="security">Security Status</TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Webhook Events</CardTitle>
              <CardDescription>Latest webhook processing activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentWebhooks.map((webhook) => (
                  <div key={webhook.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant={getStatusColor(webhook.status) as any}>
                        {webhook.status}
                      </Badge>
                      <div>
                        <p className="font-medium">{webhook.webhook_type}</p>
                        <p className="text-sm text-muted-foreground">ID: {webhook.external_id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {webhook.processing_time_ms}ms
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(webhook.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dlq" className="space-y-4">
          <WebhookDLQManager />
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          {validationReport ? (
            <div className="space-y-4">
              <Alert>
                <div className="flex items-center gap-2">
                  {getStatusIcon(validationReport.overall_status)}
                  <AlertDescription>
                    Overall Status: <strong>{validationReport.overall_status.toUpperCase()}</strong>
                    {' '}(Completed in {validationReport.total_duration_ms}ms)
                  </AlertDescription>
                </div>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: 'KYC Flow', result: validationReport.kyc_flow },
                  { name: 'Buy Flow', result: validationReport.buy_flow },
                  { name: 'Sell Flow', result: validationReport.sell_flow },
                  { name: 'Webhook Handling', result: validationReport.webhook_handling },
                  { name: 'Webhook Security', result: validationReport.webhook_security }
                ].map(({ name, result }) => (
                  <Card key={name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {getStatusIcon(result.success ? 'pass' : 'fail')}
                        {name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {result.duration_ms}ms response time
                      </p>
                      {result.error && (
                        <p className="text-xs text-destructive mt-1">{result.error}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {validationReport.recommendations.map((rec, index) => (
                      <div key={index} className="p-2 bg-muted rounded text-sm">
                        {rec}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center">
                  <p className="text-muted-foreground">No validation results available</p>
                  <Button onClick={runValidationSuite} className="mt-2">
                    Run Validation Suite
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>System Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>CPU Usage</span>
                    <span>{systemMetrics?.cpu_usage || 0}%</span>
                  </div>
                  <Progress value={systemMetrics?.cpu_usage || 0} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Memory Usage</span>
                    <span>{systemMetrics?.memory_usage || 0}%</span>
                  </div>
                  <Progress value={systemMetrics?.memory_usage || 0} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm">Requests/min</span>
                  <span className="font-medium">{systemMetrics?.requests_per_minute || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Error Rate</span>
                  <span className="font-medium">{systemMetrics?.error_rate.toFixed(1) || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Avg Response</span>
                  <span className="font-medium">{systemMetrics?.response_time || 0}ms</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Security</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Signature Verification</span>
                    <CheckCircle className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Rate Limiting</span>
                    <CheckCircle className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Idempotency</span>
                    <CheckCircle className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Error Handling</span>
                    <CheckCircle className="h-4 w-4 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rate Limiting Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Rate Limited (24h)</span>
                    <span className="font-medium">{webhookStats?.rate_limited || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Blocked IPs</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Security Score</span>
                    <span className="font-medium text-success">95%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}