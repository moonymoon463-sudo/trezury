import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, Eye, EyeOff, Clock } from "lucide-react";
import { securityMonitoringService } from "@/services/securityMonitoringService";
import { toast } from "sonner";

export function SecurityMonitoringWidget() {
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [transactionAlerts, setTransactionAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);

  const loadSecurityData = async () => {
    try {
      const [events, alerts] = await Promise.all([
        securityMonitoringService.getUserSecurityEvents(10),
        securityMonitoringService.getTransactionAlerts()
      ]);

      setSecurityEvents(events);
      setTransactionAlerts(alerts);
    } catch (error) {
      console.error('Failed to load security data:', error);
      toast.error('Failed to load security monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const toggleRealTimeMonitoring = () => {
    if (!realTimeEnabled) {
      // Set up real-time monitoring
      const unsubscribe = securityMonitoringService.setupRealTimeMonitoring((alert) => {
        toast.info(`Security Alert: ${alert.event_type}`);
        loadSecurityData(); // Refresh data when new alerts come in
      });

      setRealTimeEnabled(true);
      toast.success('Real-time security monitoring enabled');

      // Store cleanup function
      (window as any).__securityUnsubscribe = unsubscribe;
    } else {
      // Disable real-time monitoring
      if ((window as any).__securityUnsubscribe) {
        (window as any).__securityUnsubscribe();
        delete (window as any).__securityUnsubscribe;
      }
      setRealTimeEnabled(false);
      toast.info('Real-time security monitoring disabled');
    }
  };

  useEffect(() => {
    loadSecurityData();

    // Cleanup on unmount
    return () => {
      if ((window as any).__securityUnsubscribe) {
        (window as any).__securityUnsubscribe();
        delete (window as any).__securityUnsubscribe;
      }
    };
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

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
            <span>Loading security data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalEvents = securityEvents.filter(e => e.severity === 'critical');
  const highAlerts = transactionAlerts.filter(a => a.severity === 'high' || a.severity === 'critical');
  const unresolvedAlerts = transactionAlerts.filter(a => !a.resolved);

  return (
    <div className="space-y-4">
      {/* Security Status Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Monitoring
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={toggleRealTimeMonitoring}
                variant={realTimeEnabled ? "default" : "outline"}
                size="sm"
              >
                {realTimeEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button
                onClick={() => setShowDetails(!showDetails)}
                variant="outline"
                size="sm"
              >
                {showDetails ? 'Hide' : 'Show'} Details
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{criticalEvents.length}</p>
              <p className="text-sm text-muted-foreground">Critical Events</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{highAlerts.length}</p>
              <p className="text-sm text-muted-foreground">High Priority</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{unresolvedAlerts.length}</p>
              <p className="text-sm text-muted-foreground">Unresolved</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{securityEvents.length}</p>
              <p className="text-sm text-muted-foreground">Total Events</p>
            </div>
          </div>

          {realTimeEnabled && (
            <Alert className="mt-4">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Real-time security monitoring is active. You'll receive immediate notifications of security events.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Critical Events Alert */}
      {criticalEvents.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{criticalEvents.length} critical security event(s)</strong> require immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {showDetails && (
        <>
          {/* Recent Security Events */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Security Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {securityEvents.length > 0 ? (
                  securityEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(event.severity) as any}>
                            {event.severity?.toUpperCase() || 'UNKNOWN'}
                          </Badge>
                          <span className="font-medium">{event.event_type}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatTimestamp(event.detected_at || event.created_at)}
                        </p>
                      </div>
                      {event.session_id && (
                        <Badge variant="outline" className="text-xs">
                          Session: {event.session_id.slice(0, 8)}...
                        </Badge>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No security events recorded
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transaction Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transaction Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactionAlerts.length > 0 ? (
                  transactionAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(alert.severity) as any}>
                            {alert.severity?.toUpperCase() || 'UNKNOWN'}
                          </Badge>
                          <span className="font-medium">{alert.alert_type}</span>
                          {!alert.resolved && <Badge variant="outline">Unresolved</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {alert.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatTimestamp(alert.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        TX: {alert.transaction_id?.slice(0, 8)}...
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No transaction alerts
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}