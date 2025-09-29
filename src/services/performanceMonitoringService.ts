/**
 * Performance monitoring service for 10k+ users
 * Tracks system performance, user behavior, and capacity metrics
 */

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface SystemHealthData {
  active_users: number;
  total_users: number;
  total_transactions: number;
  avg_response_time_ms: number;
  system_load: 'low' | 'medium' | 'high';
  capacity_status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
}

interface PerformanceAlert {
  type: 'warning' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
}

class PerformanceMonitoringService {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  
  // Scaling limits for 10k+ users
  private readonly MAX_METRICS = 10000; // Circular buffer
  private readonly MAX_ALERTS = 1000;
  private readonly CLEANUP_INTERVAL_MS = 60000; // 1 minute
  private readonly METRIC_RETENTION_MS = 3600000; // 1 hour
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private thresholds = {
    response_time_ms: { warning: 500, critical: 1000 },
    active_users: { warning: 5000, critical: 8000 },
    memory_usage: { warning: 80, critical: 95 },
    cpu_usage: { warning: 70, critical: 90 },
    error_rate: { warning: 5, critical: 10 }
  };

  constructor() {
    this.startPerformanceTracking();
    this.startCleanupTimer();
  }

  /**
   * Record a performance metric with circular buffer
   */
  async recordMetric(
    name: string,
    value: number,
    unit: string = 'count',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      metadata
    };

    // Circular buffer - remove oldest when at limit
    if (this.metrics.length >= this.MAX_METRICS) {
      this.metrics.shift();
    }
    this.metrics.push(metric);

    // Check for alerts
    this.checkThresholds(metric);

    // Persist critical metrics only
    if (name.includes('error') || name.includes('critical')) {
      this.persistMetric(metric).catch(error => 
        console.error('Failed to persist metric:', error)
      );
    }
  }

  /**
   * Record API response time
   */
  recordResponseTime(endpoint: string, duration: number): void {
    this.recordMetric('api_response_time_ms', duration, 'milliseconds', {
      endpoint
    });
  }

  /**
   * Record user action
   */
  recordUserAction(action: string, userId?: string): void {
    this.recordMetric('user_action', 1, 'count', {
      action,
      user_id: userId
    });
  }

  /**
   * Record transaction metrics
   */
  recordTransaction(type: string, amount: number, success: boolean): void {
    this.recordMetric('transaction', 1, 'count', {
      type,
      amount,
      success,
      status: success ? 'completed' : 'failed'
    });
  }

  /**
   * Record system resource usage
   */
  recordSystemMetrics(cpu: number, memory: number, activeUsers: number): void {
    this.recordMetric('cpu_usage_percent', cpu, 'percent');
    this.recordMetric('memory_usage_percent', memory, 'percent');
    this.recordMetric('active_users', activeUsers, 'count');
  }

  /**
   * Get system health data from database
   */
  async getSystemHealth(): Promise<SystemHealthData | null> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.rpc('get_system_health_metrics');
      
      if (error) throw error;
      return data as unknown as SystemHealthData;
    } catch (error) {
      console.error('Failed to get system health:', error);
      return null;
    }
  }

  /**
   * Get recent performance metrics
   */
  getRecentMetrics(name?: string, limit: number = 100): PerformanceMetric[] {
    let filtered = this.metrics;
    
    if (name) {
      filtered = this.metrics.filter(m => m.name === name);
    }
    
    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(timeWindowMs: number = 300000): { // 5 minutes default
    metrics: Record<string, { avg: number; max: number; min: number; count: number }>;
    alerts: PerformanceAlert[];
  } {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);
    const recentAlerts = this.alerts.filter(a => a.timestamp > cutoff);

    const summary: Record<string, { avg: number; max: number; min: number; count: number }> = {};
    
    // Group metrics by name
    const grouped = recentMetrics.reduce((acc, metric) => {
      if (!acc[metric.name]) acc[metric.name] = [];
      acc[metric.name].push(metric.value);
      return acc;
    }, {} as Record<string, number[]>);

    // Calculate summary stats
    Object.entries(grouped).forEach(([name, values]) => {
      summary[name] = {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        max: Math.max(...values),
        min: Math.min(...values),
        count: values.length
      };
    });

    return { metrics: summary, alerts: recentAlerts };
  }

  /**
   * Check performance thresholds and create alerts
   */
  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds[metric.name as keyof typeof this.thresholds];
    if (!threshold) return;

    let alertType: 'warning' | 'critical' | null = null;
    
    if (metric.value >= threshold.critical) {
      alertType = 'critical';
    } else if (metric.value >= threshold.warning) {
      alertType = 'warning';
    }

    if (alertType) {
      const alert: PerformanceAlert = {
        type: alertType,
        message: `${metric.name} is ${alertType}: ${metric.value}${metric.unit}`,
        metric: metric.name,
        value: metric.value,
        threshold: threshold[alertType],
        timestamp: metric.timestamp
      };

      this.alerts.push(alert);
      
      // Keep only recent alerts
      if (this.alerts.length > 100) {
        this.alerts.shift();
      }

      // Log critical alerts
      if (alertType === 'critical') {
        console.error('Critical performance alert:', alert);
      }
    }
  }

  /**
   * Persist metric to database
   */
  private async persistMetric(metric: PerformanceMetric): Promise<void> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.rpc('record_performance_metric', {
        p_metric_name: metric.name,
        p_metric_value: metric.value,
        p_metric_unit: metric.unit,
        p_metadata: metric.metadata || {}
      });
    } catch (error) {
      // Don't throw - this shouldn't block the main application
      console.error('Failed to persist performance metric:', error);
    }
  }

  /**
   * Start automatic performance tracking
   */
  private startPerformanceTracking(): void {
    // Track page performance
    if (typeof window !== 'undefined' && 'performance' in window) {
      // Track navigation timing
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navigation) {
            this.recordMetric('page_load_time', navigation.loadEventEnd - navigation.fetchStart, 'milliseconds');
          }
        }, 1000);
      });

      // Track resource timing
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'measure') {
            this.recordMetric('custom_timing', entry.duration, 'milliseconds', {
              name: entry.name
            });
          }
        });
      });
      
      observer.observe({ entryTypes: ['measure'] });
    }

    // Periodic system health check
    setInterval(async () => {
      const health = await this.getSystemHealth();
      if (health) {
        this.recordMetric('system_active_users', health.active_users, 'count');
        this.recordMetric('system_response_time', health.avg_response_time_ms, 'milliseconds');
      }
    }, 30000); // Every 30 seconds

    // Monitor browser memory
    if (typeof window !== 'undefined' && (window.performance as any).memory) {
      setInterval(() => {
        const memory = (window.performance as any).memory;
        this.recordMetric('heap_size_mb', memory.usedJSHeapSize / (1024 * 1024), 'MB');
      }, 30000);
    }
  }

  /**
   * Create performance timing marks
   */
  mark(name: string): void {
    if (typeof performance !== 'undefined') {
      performance.mark(name);
    }
  }

  /**
   * Measure performance between marks
   */
  measure(name: string, startMark: string, endMark: string): void {
    if (typeof performance !== 'undefined') {
      performance.measure(name, startMark, endMark);
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Clear old metrics with hard limits
   */
  cleanup(): void {
    const cutoff = Date.now() - this.METRIC_RETENTION_MS;
    
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);

    // Enforce hard limits
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts = this.alerts.slice(-this.MAX_ALERTS);
    }

    console.log(`[Performance] Cleanup: ${this.metrics.length} metrics, ${this.alerts.length} alerts`);
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.metrics = [];
    this.alerts = [];
  }
}

export const performanceMonitoringService = new PerformanceMonitoringService();
