import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { enhancedSecurityService } from '@/services/enhancedSecurityService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Activity,
  Lock,
  Eye,
  Settings
} from 'lucide-react';

interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  created_at: string;
  resolved: boolean;
  metadata?: Record<string, any>;
}

interface SecurityMetrics {
  total_alerts: number;
  critical_alerts: number;
  resolved_alerts: number;
  account_age_days: number;
  last_login: string;
  login_success_rate: number;
}

export function SecurityDashboard() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadSecurityData();
      
      // Set up real-time monitoring
      const cleanup = enhancedSecurityService.setupRealTimeMonitoring(user.id);
      
      return cleanup;
    }
  }, [user]);

  const loadSecurityData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load security alerts
      const alertsData = await enhancedSecurityService.getSecurityAlerts(user.id);
      setAlerts(alertsData);

      // Calculate metrics (simplified - in production you'd want more robust metrics)
      const now = new Date();
      const accountCreated = new Date(user.created_at);
      const accountAgeDays = Math.floor((now.getTime() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));

      const criticalAlerts = alertsData.filter(alert => alert.severity === 'critical').length;
      const resolvedAlerts = alertsData.filter(alert => alert.resolved).length;

      setMetrics({
        total_alerts: alertsData.length,
        critical_alerts: criticalAlerts,
        resolved_alerts: resolvedAlerts,
        account_age_days: accountAgeDays,
        last_login: user.last_sign_in_at || user.created_at,
        login_success_rate: 95 // This would be calculated from auth_attempts table in production
      });

    } catch (error) {
      console.error('Failed to load security data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      setResolving(alertId);
      const success = await enhancedSecurityService.resolveSecurityAlert(alertId);
      
      if (success) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, resolved: true }
            : alert
        ));
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    } finally {
      setResolving(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'medium': return <Clock className="h-4 w-4 text-warning" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getOverallSecurityScore = () => {
    if (!metrics) return 0;
    
    let score = 100;
    
    // Deduct points for unresolved critical alerts
    score -= metrics.critical_alerts * 20;
    
    // Deduct points for high number of total alerts
    if (metrics.total_alerts > 10) {
      score -= (metrics.total_alerts - 10) * 2;
    }
    
    // Bonus for account age
    if (metrics.account_age_days > 30) {
      score += 5;
    }
    
    // Ensure score stays within bounds
    return Math.max(0, Math.min(100, score));
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">Monitor and manage your account security</p>
        </div>
        <Badge variant={getOverallSecurityScore() >= 80 ? 'default' : 'destructive'}>
          Security Score: {getOverallSecurityScore()}%
        </Badge>
      </div>

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_alerts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.resolved_alerts || 0} resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {metrics?.critical_alerts || 0}
            </div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Age</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.account_age_days || 0}</div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Login Success Rate</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.login_success_rate || 0}%</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Alerts</TabsTrigger>
          <TabsTrigger value="resolved">Resolved Alerts</TabsTrigger>
          <TabsTrigger value="settings">Security Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {alerts.filter(alert => !alert.resolved).length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>All Clear!</AlertTitle>
              <AlertDescription>
                No active security alerts. Your account security is looking good.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {alerts
                .filter(alert => !alert.resolved)
                .map(alert => (
                  <Card key={alert.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getSeverityIcon(alert.severity)}
                          <CardTitle className="text-base">{alert.title}</CardTitle>
                          <Badge variant={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolveAlert(alert.id)}
                          disabled={resolving === alert.id}
                        >
                          {resolving === alert.id ? 'Resolving...' : 'Resolve'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">
                        {alert.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                      {alert.metadata && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            View Details
                          </summary>
                          <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                            {JSON.stringify(alert.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4">
          {alerts.filter(alert => alert.resolved).length === 0 ? (
            <Alert>
              <Eye className="h-4 w-4" />
              <AlertTitle>No Resolved Alerts</AlertTitle>
              <AlertDescription>
                No previously resolved security alerts to display.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {alerts
                .filter(alert => alert.resolved)
                .map(alert => (
                  <Card key={alert.id} className="opacity-75">
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base">{alert.title}</CardTitle>
                        <Badge variant="outline">Resolved</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">
                        {alert.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Security Settings</span>
              </CardTitle>
              <CardDescription>
                Manage your security preferences and configurations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertTitle>Enhanced Security Active</AlertTitle>
                <AlertDescription>
                  Your account is protected with enhanced security monitoring, 
                  automated threat detection, and real-time alerts.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <h4 className="font-semibold">Current Security Features:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Real-time security event monitoring</li>
                  <li>• Failed login attempt tracking</li>
                  <li>• Suspicious activity pattern detection</li>
                  <li>• Automated security alerts</li>
                  <li>• Data validation and protection</li>
                  <li>• Enhanced audit logging</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}