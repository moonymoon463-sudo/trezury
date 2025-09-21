import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Activity, Zap, Database, Shield, AlertTriangle } from 'lucide-react';

interface PerformanceMetric {
  name: string;
  value: number;
  target: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
}

interface SystemAlert {
  id: string;
  type: 'performance' | 'security' | 'capacity' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export function ProductionOptimizations() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([
    { name: 'Response Time', value: 120, target: 200, unit: 'ms', status: 'good' },
    { name: 'Database Load', value: 65, target: 80, unit: '%', status: 'warning' },
    { name: 'Memory Usage', value: 78, target: 85, unit: '%', status: 'warning' },
    { name: 'Transaction Success Rate', value: 99.2, target: 99.5, unit: '%', status: 'good' },
    { name: 'Gas Efficiency', value: 92, target: 95, unit: '%', status: 'warning' }
  ]);

  const [alerts, setAlerts] = useState<SystemAlert[]>([
    {
      id: '1',
      type: 'performance',
      severity: 'medium',
      message: 'Database query optimization needed for user_supplies table',
      timestamp: '2024-01-15 14:30',
      resolved: false
    },
    {
      id: '2',
      type: 'capacity',
      severity: 'high',
      message: 'Edge function invocation limit approaching (80% of daily quota)',
      timestamp: '2024-01-15 13:45',
      resolved: false
    }
  ]);

  const [cacheStats, setCacheStats] = useState({
    hitRate: 94.5,
    missRate: 5.5,
    totalRequests: 15420,
    cachedResponses: 14572
  });

  const [batchProcessing, setBatchProcessing] = useState({
    queuedTransactions: 45,
    processingBatch: true,
    avgBatchSize: 12,
    gasOptimization: 23.5
  });

  const optimizeQueries = async () => {
    toast({
      title: "Query Optimization Started",
      description: "Analyzing and optimizing database queries...",
    });
    
    // Simulate optimization
    setTimeout(() => {
      setMetrics(prev => prev.map(metric => 
        metric.name === 'Database Load' 
          ? { ...metric, value: 45, status: 'good' as const }
          : metric
      ));
      
      toast({
        title: "Optimization Complete",
        description: "Database query performance improved by 31%",
      });
    }, 3000);
  };

  const enableBatchProcessing = async () => {
    setBatchProcessing(prev => ({ ...prev, processingBatch: true }));
    
    toast({
      title: "Batch Processing Enabled",
      description: "Transactions will be processed in optimized batches",
    });
  };

  const refreshCache = async () => {
    toast({
      title: "Cache Refresh Started",
      description: "Refreshing application cache...",
    });
    
    setTimeout(() => {
      setCacheStats(prev => ({
        ...prev,
        hitRate: 97.8,
        missRate: 2.2
      }));
      
      toast({
        title: "Cache Refreshed",
        description: "Cache hit rate improved to 97.8%",
      });
    }, 2000);
  };

  const resolveAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, resolved: true }
        : alert
    ));
    
    toast({
      title: "Alert Resolved",
      description: "System alert has been marked as resolved",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-500/20 text-blue-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'high': return 'bg-orange-500/20 text-orange-400';
      case 'critical': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'performance': return <Zap className="w-4 h-4" />;
      case 'security': return <Shield className="w-4 h-4" />;
      case 'capacity': return <Database className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Activity className="w-5 h-5 text-primary" />
            System Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {metrics.map((metric, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">{metric.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${getStatusColor(metric.status)}`}>
                    {metric.value}{metric.unit}
                  </span>
                  <span className="text-gray-400 text-sm">
                    / {metric.target}{metric.unit}
                  </span>
                </div>
              </div>
              <Progress 
                value={(metric.value / metric.target) * 100} 
                className="h-2"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Database className="w-5 h-5 text-primary" />
              Cache Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Hit Rate</div>
                <div className="text-green-400 font-medium text-lg">
                  {cacheStats.hitRate.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-gray-400">Miss Rate</div>
                <div className="text-orange-400 font-medium text-lg">
                  {cacheStats.missRate.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-gray-400">Total Requests</div>
                <div className="text-white">{cacheStats.totalRequests.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-400">Cached Responses</div>
                <div className="text-white">{cacheStats.cachedResponses.toLocaleString()}</div>
              </div>
            </div>
            
            <Button onClick={refreshCache} variant="outline" className="w-full">
              Refresh Cache
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Zap className="w-5 h-5 text-primary" />
              Batch Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Queued Transactions</div>
                <div className="text-white font-medium text-lg">
                  {batchProcessing.queuedTransactions}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Avg Batch Size</div>
                <div className="text-white font-medium text-lg">
                  {batchProcessing.avgBatchSize}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Status</div>
                <Badge className={batchProcessing.processingBatch ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                  {batchProcessing.processingBatch ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <div className="text-gray-400">Gas Savings</div>
                <div className="text-green-400 font-medium">
                  {batchProcessing.gasOptimization.toFixed(1)}%
                </div>
              </div>
            </div>
            
            <Button 
              onClick={enableBatchProcessing} 
              disabled={batchProcessing.processingBatch}
              variant="outline" 
              className="w-full"
            >
              {batchProcessing.processingBatch ? 'Batch Processing Active' : 'Enable Batch Processing'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="w-5 h-5 text-primary" />
            System Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {alerts.filter(alert => !alert.resolved).length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No active alerts</p>
              <p className="text-sm">All systems operating normally</p>
            </div>
          ) : (
            alerts.filter(alert => !alert.resolved).map((alert) => (
              <Card key={alert.id} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getAlertIcon(alert.type)}
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                      <span className="text-gray-400 text-sm capitalize">
                        {alert.type}
                      </span>
                    </div>
                    <span className="text-gray-400 text-sm">
                      {alert.timestamp}
                    </span>
                  </div>
                  
                  <p className="text-white mb-3">{alert.message}</p>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => resolveAlert(alert.id)}
                      size="sm"
                      variant="outline"
                    >
                      Mark Resolved
                    </Button>
                    {alert.type === 'performance' && (
                      <Button
                        onClick={optimizeQueries}
                        size="sm"
                        className="bg-primary hover:bg-primary/90"
                      >
                        Optimize Now
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}