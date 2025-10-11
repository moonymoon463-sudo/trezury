/**
 * Live Swap Monitoring Dashboard
 * ✅ PHASE 5: MONITORING UI
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Clock, XCircle, TrendingUp } from 'lucide-react';

interface MonitoringMetrics {
  activeSwaps: number;
  failedSignatures24h: number;
  quoteExpirations24h: number;
  idempotencyRejections24h: number;
  averageCompletionTimeSec: number;
  largeBalanceChanges24h: number;
  zeroXDowntime: boolean;
}

export const LiveSwapMonitoring = () => {
  const [metrics, setMetrics] = useState<MonitoringMetrics>({
    activeSwaps: 0,
    failedSignatures24h: 0,
    quoteExpirations24h: 0,
    idempotencyRejections24h: 0,
    averageCompletionTimeSec: 0,
    largeBalanceChanges24h: 0,
    zeroXDowntime: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 86400000).toISOString();
        const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();

        // Active swaps (last hour)
        const { data: activeSwaps } = await supabase
          .from('transaction_intents')
          .select('id', { count: 'exact' })
          .in('status', ['initiated', 'validating', 'funds_pulled'])
          .gte('created_at', oneHourAgo);

        // Failed signatures (24h)
        const { data: failedSigs, count: failedCount } = await supabase
          .from('signature_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('success', false)
          .gte('created_at', oneDayAgo);

        // Large balance changes (24h)
        const { data: balanceAlerts, count: balanceCount } = await supabase
          .from('balance_change_alerts')
          .select('*', { count: 'exact', head: true })
          .in('alert_severity', ['high', 'critical'])
          .gte('created_at', oneDayAgo);

        // 0x API downtime
        const { data: apiDowntime } = await supabase
          .from('api_downtime_log')
          .select('resolved_at')
          .eq('provider', '0x')
          .order('detected_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Completed swaps for average time
        const { data: completedSwaps } = await supabase
          .from('transactions')
          .select('created_at, updated_at')
          .eq('type', 'swap')
          .eq('status', 'completed')
          .gte('created_at', oneDayAgo)
          .limit(100);

        let avgTime = 0;
        if (completedSwaps && completedSwaps.length > 0) {
          const times = completedSwaps.map(tx => 
            new Date(tx.updated_at).getTime() - new Date(tx.created_at).getTime()
          );
          avgTime = times.reduce((a, b) => a + b, 0) / times.length / 1000; // Convert to seconds
        }

        setMetrics({
          activeSwaps: activeSwaps?.length || 0,
          failedSignatures24h: failedCount || 0,
          quoteExpirations24h: 0, // TODO: Add when we track this separately
          idempotencyRejections24h: 0, // TODO: Add when we track this separately
          averageCompletionTimeSec: Math.round(avgTime),
          largeBalanceChanges24h: balanceCount || 0,
          zeroXDowntime: apiDowntime ? !apiDowntime.resolved_at : false
        });
      } catch (error) {
        console.error('Failed to fetch monitoring metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Update every 10s
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>🔴 Live Swap Monitoring</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading metrics...</p>
        </CardContent>
      </Card>
    );
  }

  const getHealthStatus = () => {
    if (metrics.zeroXDowntime) return { color: 'destructive', label: 'API Down', icon: XCircle };
    if (metrics.failedSignatures24h > 10) return { color: 'destructive', label: 'Issues Detected', icon: AlertCircle };
    if (metrics.failedSignatures24h > 5) return { color: 'warning', label: 'Monitoring', icon: Clock };
    return { color: 'success', label: 'Healthy', icon: CheckCircle };
  };

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          🔴 Live Swap Monitoring
          <Badge variant={health.color as any} className="ml-2">
            <HealthIcon className="w-3 h-3 mr-1" />
            {health.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Active Swaps */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Active Swaps</p>
            </div>
            <p className="text-2xl font-bold">{metrics.activeSwaps}</p>
            <p className="text-xs text-muted-foreground">Last hour</p>
          </div>

          {/* Failed Signatures */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className={`w-4 h-4 ${metrics.failedSignatures24h > 10 ? 'text-red-500' : 'text-muted-foreground'}`} />
              <p className="text-xs text-muted-foreground">Failed Signatures</p>
            </div>
            <p className={`text-2xl font-bold ${metrics.failedSignatures24h > 10 ? 'text-red-600' : ''}`}>
              {metrics.failedSignatures24h}
            </p>
            <p className="text-xs text-muted-foreground">Last 24h</p>
          </div>

          {/* Balance Changes */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className={`w-4 h-4 ${metrics.largeBalanceChanges24h > 5 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
              <p className="text-xs text-muted-foreground">Large Balance Changes</p>
            </div>
            <p className={`text-2xl font-bold ${metrics.largeBalanceChanges24h > 5 ? 'text-yellow-600' : ''}`}>
              {metrics.largeBalanceChanges24h}
            </p>
            <p className="text-xs text-muted-foreground">Last 24h ({'>'}50%)</p>
          </div>

          {/* Avg Completion Time */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Avg Completion</p>
            </div>
            <p className="text-2xl font-bold">{metrics.averageCompletionTimeSec}s</p>
            <p className="text-xs text-muted-foreground">Per swap</p>
          </div>
        </div>

        {/* API Status Alert */}
        {metrics.zeroXDowntime && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="font-semibold text-red-900 dark:text-red-100">0x API Downtime Detected</p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Swaps may fail until the API is restored. Users should be notified.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
