import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Zap,
  Shield,
  Target
} from 'lucide-react';

interface AlertItem {
  id: string;
  type: 'opportunity' | 'warning' | 'info' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  category: 'market' | 'portfolio' | 'risk' | 'performance';
}

interface RealTimeAlertsProps {
  alerts?: AlertItem[];
  onDismiss?: (alertId: string) => void;
  onTakeAction?: (alertId: string) => void;
}

// Mock alerts for demo
const mockAlerts: AlertItem[] = [
  {
    id: '1',
    type: 'opportunity',
    title: 'Gold Price Dip Detected',
    message: 'Gold is down 2.1% today. This may be a good buying opportunity based on your risk profile.',
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    priority: 'high',
    actionable: true,
    category: 'market'
  },
  {
    id: '2',
    type: 'warning',
    title: 'High Portfolio Concentration',
    message: 'Your portfolio is 78% allocated to gold. Consider diversification to reduce risk.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    priority: 'medium',
    actionable: true,
    category: 'risk'
  },
  {
    id: '3',
    type: 'info',
    title: 'Monthly Rebalancing Due',
    message: 'Your scheduled monthly portfolio rebalancing is due in 3 days.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
    priority: 'low',
    actionable: true,
    category: 'portfolio'
  },
  {
    id: '4',
    type: 'critical',
    title: 'Unusual Market Volatility',
    message: 'Gold volatility has increased 45% above normal levels. Review your risk tolerance.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
    priority: 'high',
    actionable: true,
    category: 'risk'
  }
];

export function RealTimeAlerts({ alerts = mockAlerts, onDismiss, onTakeAction }: RealTimeAlertsProps) {
  const getAlertIcon = (type: AlertItem['type']) => {
    switch (type) {
      case 'opportunity': return TrendingUp;
      case 'warning': return AlertTriangle;
      case 'critical': return Shield;
      case 'info': return CheckCircle;
    }
  };

  const getAlertColor = (type: AlertItem['type']) => {
    switch (type) {
      case 'opportunity': return 'text-success border-success/20 bg-success/10';
      case 'warning': return 'text-warning border-warning/20 bg-warning/10';
      case 'critical': return 'text-destructive border-destructive/20 bg-destructive/10';
      case 'info': return 'text-info border-info/20 bg-info/10';
    }
  };

  const getPriorityBadge = (priority: AlertItem['priority']) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryIcon = (category: AlertItem['category']) => {
    switch (category) {
      case 'market': return TrendingUp;
      case 'portfolio': return Target;
      case 'risk': return Shield;
      case 'performance': return Zap;
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  const groupedAlerts = alerts.reduce((groups, alert) => {
    if (!groups[alert.category]) {
      groups[alert.category] = [];
    }
    groups[alert.category].push(alert);
    return groups;
  }, {} as Record<string, AlertItem[]>);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Real-Time Alerts
        </CardTitle>
        <CardDescription>
          Smart notifications based on market conditions and portfolio analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          <div className="space-y-4">
            {Object.entries(groupedAlerts).map(([category, categoryAlerts]) => {
              const CategoryIcon = getCategoryIcon(category as AlertItem['category']);
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium capitalize">{category}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {categoryAlerts.length}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {categoryAlerts.map((alert) => {
                      const Icon = getAlertIcon(alert.type);
                      return (
                        <div
                          key={alert.id}
                          className={`p-3 border rounded-lg ${getAlertColor(alert.type)}`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className="h-4 w-4 mt-1 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="font-medium text-sm">{alert.title}</h5>
                                <div className="flex items-center gap-2">
                                  <Badge className={getPriorityBadge(alert.priority)}>
                                    {alert.priority}
                                  </Badge>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatTimeAgo(alert.timestamp)}
                                  </div>
                                </div>
                              </div>
                              
                              <p className="text-sm opacity-90">
                                {alert.message}
                              </p>
                              
                              {alert.actionable && (
                                <div className="flex items-center gap-2 pt-2">
                                  <Button
                                    size="sm"
                                    className="h-7 px-3 text-xs"
                                    onClick={() => onTakeAction?.(alert.id)}
                                  >
                                    Take Action
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-3 text-xs"
                                    onClick={() => onDismiss?.(alert.id)}
                                  >
                                    Dismiss
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {alerts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">All Clear</h3>
            <p className="text-sm">
              No active alerts. Your portfolio is performing within normal parameters.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}