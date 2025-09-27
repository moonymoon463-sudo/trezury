import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Bell,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Settings,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AlertService } from '@/services/AlertService';
import AurumLogo from '@/components/AurumLogo';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notification_channels: string[];
  cooldown_minutes: number;
  created_at: string;
}

interface ActiveAlert {
  id: string;
  rule_name: string;
  severity: string;
  message: string;
  triggered_at: string;
  acknowledged: boolean;
  resolved: boolean;
  current_value: number;
  threshold: number;
}

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
}

const AlertManagementSystem = () => {
  const navigate = useNavigate();
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRule, setShowCreateRule] = useState(false);

  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    metric: '',
    condition: 'greater_than' as const,
    threshold: 0,
    severity: 'medium' as const,
    notification_channels: [] as string[],
    cooldown_minutes: 15
  });

  const loadAlertData = async () => {
    try {
      const [rules, alerts, channels] = await Promise.all([
        AlertService.getAlertRules(),
        AlertService.getActiveAlerts(),
        AlertService.getNotificationChannels()
      ]);
      
      setAlertRules(rules);
      setActiveAlerts(alerts);
      setNotificationChannels(channels);
    } catch (error) {
      console.error('Failed to load alert data:', error);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await loadAlertData();
      setLoading(false);
    };

    initializeData();

    // Set up periodic updates for active alerts
    const interval = setInterval(() => {
      AlertService.getActiveAlerts().then(setActiveAlerts);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleCreateRule = async () => {
    try {
      await AlertService.createAlertRule(newRule);
      await loadAlertData();
      setShowCreateRule(false);
      setNewRule({
        name: '',
        description: '',
        metric: '',
        condition: 'greater_than',
        threshold: 0,
        severity: 'medium',
        notification_channels: [],
        cooldown_minutes: 15
      });
    } catch (error) {
      console.error('Failed to create alert rule:', error);
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await AlertService.updateAlertRule(ruleId, { enabled });
      await loadAlertData();
    } catch (error) {
      console.error('Failed to toggle alert rule:', error);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await AlertService.acknowledgeAlert(alertId);
      await loadAlertData();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await AlertService.resolveAlert(alertId);
      await loadAlertData();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />;
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Clock className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'slack': return <MessageSquare className="h-4 w-4" />;
      case 'sms': return <Phone className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading alert management...</p>
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
            <h1 className="text-xl font-bold text-foreground">Alert Management</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {activeAlerts.filter(a => !a.acknowledged).length} Active
            </Badge>
            <Button onClick={() => setShowCreateRule(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Rule
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        <Tabs defaultValue="active-alerts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active-alerts">Active Alerts</TabsTrigger>
            <TabsTrigger value="alert-rules">Alert Rules</TabsTrigger>
            <TabsTrigger value="channels">Notification Channels</TabsTrigger>
          </TabsList>

          <TabsContent value="active-alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeAlerts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p>No active alerts. System is running smoothly!</p>
                    </div>
                  ) : (
                    activeAlerts.map((alert) => (
                      <div key={alert.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(alert.severity)}
                            <Badge variant="default" className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                          </div>
                          <div>
                            <div className="font-medium">{alert.rule_name}</div>
                            <div className="text-sm text-muted-foreground">{alert.message}</div>
                            <div className="text-xs text-muted-foreground">
                              Triggered: {new Date(alert.triggered_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-right">
                            <div>Current: {alert.current_value}</div>
                            <div className="text-muted-foreground">Threshold: {alert.threshold}</div>
                          </div>
                          {!alert.acknowledged && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                          {alert.acknowledged && !alert.resolved && (
                            <Button 
                              size="sm" 
                              onClick={() => handleResolveAlert(alert.id)}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alert-rules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Alert Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {alertRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <Switch 
                          checked={rule.enabled}
                          onCheckedChange={(enabled) => handleToggleRule(rule.id, enabled)}
                        />
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {rule.name}
                            <Badge variant="outline" className={getSeverityColor(rule.severity)}>
                              {rule.severity}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">{rule.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {rule.metric} {rule.condition.replace('_', ' ')} {rule.threshold}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channels" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {notificationChannels.map((channel) => (
                    <div key={channel.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {getChannelIcon(channel.type)}
                          <span className="font-medium">{channel.name}</span>
                          <Badge variant="outline">{channel.type}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={channel.enabled} />
                        <Button size="sm" variant="outline">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Rule Modal */}
        {showCreateRule && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Create New Alert Rule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Rule Name</Label>
                    <Input 
                      id="name"
                      value={newRule.name}
                      onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                      placeholder="High CPU Usage"
                    />
                  </div>
                  <div>
                    <Label htmlFor="metric">Metric</Label>
                    <Select value={newRule.metric} onValueChange={(value) => setNewRule({...newRule, metric: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select metric" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpu_usage">CPU Usage</SelectItem>
                        <SelectItem value="memory_usage">Memory Usage</SelectItem>
                        <SelectItem value="disk_usage">Disk Usage</SelectItem>
                        <SelectItem value="response_time">Response Time</SelectItem>
                        <SelectItem value="error_rate">Error Rate</SelectItem>
                        <SelectItem value="active_users">Active Users</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description"
                    value={newRule.description}
                    onChange={(e) => setNewRule({...newRule, description: e.target.value})}
                    placeholder="Alert when CPU usage exceeds threshold"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="condition">Condition</Label>
                    <Select value={newRule.condition} onValueChange={(value: any) => setNewRule({...newRule, condition: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="greater_than">Greater Than</SelectItem>
                        <SelectItem value="less_than">Less Than</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="threshold">Threshold</Label>
                    <Input 
                      id="threshold"
                      type="number"
                      value={newRule.threshold}
                      onChange={(e) => setNewRule({...newRule, threshold: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="severity">Severity</Label>
                    <Select value={newRule.severity} onValueChange={(value: any) => setNewRule({...newRule, severity: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="cooldown">Cooldown (minutes)</Label>
                  <Input 
                    id="cooldown"
                    type="number"
                    value={newRule.cooldown_minutes}
                    onChange={(e) => setNewRule({...newRule, cooldown_minutes: parseInt(e.target.value) || 15})}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateRule(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRule}>
                    Create Rule
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default AlertManagementSystem;