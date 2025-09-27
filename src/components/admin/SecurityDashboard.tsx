import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, CheckCircle, Clock, RefreshCw, Activity } from "lucide-react";
import { securityMonitoringService } from "@/services/securityMonitoringService";
import { moonPayValidationService, MoonPayValidationReport } from "@/services/moonPayValidationService";
import { toast } from "sonner";

interface SecurityOverview {
  security_alerts: {
    total_today: number;
    critical_unresolved: number;
    high_unresolved: number;
    recent_events: Array<{
      id: string;
      event_type: string;
      severity: string;
      detected_at: string;
      user_id?: string;
    }>;
  };
  transaction_monitoring: {
    alerts_today: number;
    high_value_alerts: number;
    suspicious_patterns: number;
    failed_transactions: number;
  };
  system_health: {
    critical_metrics: number;
    warning_metrics: number;
    last_check: string;
  };
}

export function SecurityDashboard() {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [moonPayReport, setMoonPayReport] = useState<MoonPayValidationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSecurityOverview = async () => {
    try {
      setRefreshing(true);
      const data = await securityMonitoringService.getSecurityOverview();
      if (data) {
        setOverview(data);
      }
    } catch (error) {
      console.error('Failed to fetch security overview:', error);
      toast.error('Failed to load security overview');
    } finally {
      setRefreshing(false);
    }
  };

  const runMoonPayValidation = async () => {
    try {
      setValidating(true);
      toast.info('Running MoonPay validation tests...');
      
      const report = await moonPayValidationService.runComprehensiveValidation();
      setMoonPayReport(report);
      
      if (report.overall_status === 'pass') {
        toast.success('MoonPay validation completed successfully');
      } else if (report.overall_status === 'warning') {
        toast.warning('MoonPay validation completed with warnings');
      } else {
        toast.error('MoonPay validation failed - critical issues detected');
      }
    } catch (error) {
      console.error('MoonPay validation error:', error);
      toast.error('Failed to run MoonPay validation');
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await fetchSecurityOverview();
      setLoading(false);
    };

    loadInitialData();

    // Set up real-time monitoring
    const unsubscribe = securityMonitoringService.setupRealTimeMonitoring((alert) => {
      toast.warning(`Security Alert: ${alert.event_type}`);
      fetchSecurityOverview(); // Refresh data when new alerts come in
    });

    return unsubscribe;
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'fail': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading security dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Security Dashboard</h2>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchSecurityOverview}
            variant="outline"
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={runMoonPayValidation}
            disabled={validating}
          >
            <Activity className={`h-4 w-4 mr-2 ${validating ? 'animate-spin' : ''}`} />
            {validating ? 'Validating...' : 'Test MoonPay'}
          </Button>
        </div>
      </div>

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Security Alerts Today</p>
                <p className="text-2xl font-bold">
                  {overview?.security_alerts.total_today || 0}
                </p>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical Unresolved</p>
                <p className="text-2xl font-bold text-red-500">
                  {overview?.security_alerts.critical_unresolved || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transaction Alerts</p>
                <p className="text-2xl font-bold">
                  {overview?.transaction_monitoring.alerts_today || 0}
                </p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">System Health</p>
                <p className="text-2xl font-bold text-green-500">
                  {overview?.system_health.critical_metrics === 0 ? 'Good' : 'Issues'}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
          <TabsTrigger value="transactions">Transaction Monitoring</TabsTrigger>
          <TabsTrigger value="moonpay">MoonPay Integration</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>
                Latest security alerts and events detected in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {overview?.security_alerts.recent_events?.length ? (
                  overview.security_alerts.recent_events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(event.severity) as any}>
                            {event.severity.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{event.event_type}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(event.detected_at).toLocaleString()}
                        </p>
                      </div>
                      {event.user_id && (
                        <Badge variant="outline">
                          User: {event.user_id.slice(0, 8)}...
                        </Badge>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No recent security events</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Monitoring Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {overview?.transaction_monitoring.high_value_alerts || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">High Value</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {overview?.transaction_monitoring.suspicious_patterns || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Suspicious</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {overview?.transaction_monitoring.failed_transactions || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {overview?.transaction_monitoring.alerts_today || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Today</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="moonpay">
          <div className="space-y-4">
            {moonPayReport ? (
              <>
                <Alert>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(moonPayReport.overall_status)}
                    <AlertDescription>
                      MoonPay Integration Status: <strong>{moonPayReport.overall_status.toUpperCase()}</strong>
                      {moonPayReport.overall_status !== 'pass' && (
                        <span className="ml-2 text-red-600">
                          - Issues detected, review recommendations below
                        </span>
                      )}
                    </AlertDescription>
                  </div>
                </Alert>

                <div className="grid gap-4">
                  {[
                    { name: 'KYC Flow', result: moonPayReport.kyc_flow },
                    { name: 'Buy Flow', result: moonPayReport.buy_flow },
                    { name: 'Sell Flow', result: moonPayReport.sell_flow },
                    { name: 'Webhook Handling', result: moonPayReport.webhook_handling }
                  ].map(({ name, result }) => (
                    <Card key={name}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.success ? 'pass' : 'fail')}
                            <span className="font-medium">{name}</span>
                          </div>
                          <Badge variant={result.success ? 'default' : 'destructive'}>
                            {result.success ? 'Pass' : 'Fail'}
                          </Badge>
                        </div>
                        {result.error && (
                          <p className="text-sm text-red-600 mt-2">{result.error}</p>
                        )}
                        {result.data && (
                          <pre className="text-xs text-muted-foreground mt-2 overflow-x-auto">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {moonPayReport.recommendations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600">⚠️ Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {moonPayReport.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-red-600">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    Run MoonPay validation to test integration status
                  </p>
                  <Button onClick={runMoonPayValidation} disabled={validating}>
                    {validating ? 'Running Tests...' : 'Start Validation'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Health Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Critical Metrics</p>
                    <p className="text-sm text-muted-foreground">
                      System components requiring immediate attention
                    </p>
                  </div>
                  <Badge variant={overview?.system_health.critical_metrics === 0 ? 'default' : 'destructive'}>
                    {overview?.system_health.critical_metrics || 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Warning Metrics</p>
                    <p className="text-sm text-muted-foreground">
                      Components with elevated risk levels
                    </p>
                  </div>
                  <Badge variant={overview?.system_health.warning_metrics === 0 ? 'default' : 'secondary'}>
                    {overview?.system_health.warning_metrics || 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Last Health Check</p>
                    <p className="text-sm text-muted-foreground">
                      Most recent system monitoring update
                    </p>
                  </div>
                  <span className="text-sm">
                    {overview?.system_health.last_check 
                      ? new Date(overview.system_health.last_check).toLocaleString()
                      : 'Never'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}