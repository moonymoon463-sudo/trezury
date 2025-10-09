/**
 * Resource Monitoring Service for System Health
 * Tracks CPU, memory, network, and application resources
 */

interface ResourceMetrics {
  timestamp: number;
  cpu: {
    usage: number; // Percentage
    available: number; // Percentage
  };
  memory: {
    usedMB: number;
    limitMB: number;
    percentage: number;
  };
  network: {
    activeSockets: number;
    pendingRequests: number;
  };
  application: {
    activeUsers: number;
    requestsPerSecond: number;
    errorRate: number;
  };
}

interface ResourceAlert {
  type: 'cpu' | 'memory' | 'network' | 'application';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

class ResourceMonitoringService {
  private metrics: ResourceMetrics[] = [];
  private alerts: ResourceAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  private readonly MAX_METRICS = 1000; // Keep last 1000 measurements
  private readonly MONITORING_INTERVAL_MS = 10000; // Monitor every 10 seconds
  
  // Thresholds for alerts
  private readonly THRESHOLDS = {
    memory: {
      warning: 70, // 70% memory usage
      critical: 85, // 85% memory usage
    },
    errorRate: {
      warning: 5, // 5% error rate
      critical: 10, // 10% error rate
    },
    responseTime: {
      warning: 1000, // 1 second
      critical: 3000, // 3 seconds
    },
  };

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start automatic resource monitoring
   */
  private startMonitoring(): void {
    if (typeof window === 'undefined') return;

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.MONITORING_INTERVAL_MS);
  }

  /**
   * Collect current resource metrics
   */
  private collectMetrics(): void {
    if (typeof window === 'undefined') return;

    const metric: ResourceMetrics = {
      timestamp: Date.now(),
      cpu: this.getCPUMetrics(),
      memory: this.getMemoryMetrics(),
      network: this.getNetworkMetrics(),
      application: this.getApplicationMetrics(),
    };

    // Add to circular buffer
    if (this.metrics.length >= this.MAX_METRICS) {
      this.metrics.shift();
    }
    this.metrics.push(metric);

    // Check thresholds and generate alerts
    this.checkResourceThresholds(metric);
  }

  /**
   * Get CPU metrics (simulated for browser)
   */
  private getCPUMetrics(): { usage: number; available: number } {
    // In browser, we can't get real CPU metrics
    // Estimate based on performance and frame rate
    const usage = Math.min(100, Math.random() * 30); // Placeholder
    return {
      usage,
      available: 100 - usage,
    };
  }

  /**
   * Get memory metrics from browser
   */
  private getMemoryMetrics(): { usedMB: number; limitMB: number; percentage: number } {
    if ((window.performance as any).memory) {
      const memory = (window.performance as any).memory;
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);
      const percentage = (usedMB / limitMB) * 100;
      
      return { usedMB, limitMB, percentage };
    }

    return { usedMB: 0, limitMB: 0, percentage: 0 };
  }

  /**
   * Get network metrics
   */
  private getNetworkMetrics(): { activeSockets: number; pendingRequests: number } {
    // Estimate based on performance entries
    const resources = performance.getEntriesByType('resource');
    const recentResources = resources.filter(
      r => r.startTime > Date.now() - 10000
    );

    return {
      activeSockets: recentResources.length,
      pendingRequests: recentResources.filter(
        r => r.duration === 0
      ).length,
    };
  }

  /**
   * Get application-level metrics
   */
  private getApplicationMetrics(): {
    activeUsers: number;
    requestsPerSecond: number;
    errorRate: number;
  } {
    // These would typically come from your application state
    // Placeholder implementation
    return {
      activeUsers: 1,
      requestsPerSecond: 0,
      errorRate: 0,
    };
  }

  /**
   * Check metrics against thresholds and create alerts
   */
  private checkResourceThresholds(metric: ResourceMetrics): void {
    const { memory } = metric;

    // Memory alerts
    if (memory.percentage >= this.THRESHOLDS.memory.critical) {
      this.createAlert({
        type: 'memory',
        severity: 'critical',
        message: `Critical memory usage: ${memory.percentage.toFixed(1)}%`,
        value: memory.percentage,
        threshold: this.THRESHOLDS.memory.critical,
        timestamp: metric.timestamp,
      });
    } else if (memory.percentage >= this.THRESHOLDS.memory.warning) {
      this.createAlert({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${memory.percentage.toFixed(1)}%`,
        value: memory.percentage,
        threshold: this.THRESHOLDS.memory.warning,
        timestamp: metric.timestamp,
      });
    }

    // Application error rate alerts
    if (metric.application.errorRate >= this.THRESHOLDS.errorRate.critical) {
      this.createAlert({
        type: 'application',
        severity: 'critical',
        message: `Critical error rate: ${metric.application.errorRate.toFixed(1)}%`,
        value: metric.application.errorRate,
        threshold: this.THRESHOLDS.errorRate.critical,
        timestamp: metric.timestamp,
      });
    }
  }

  /**
   * Create a resource alert
   */
  private createAlert(alert: ResourceAlert): void {
    // Don't create duplicate recent alerts
    const recentDuplicate = this.alerts.find(
      a =>
        a.type === alert.type &&
        a.severity === alert.severity &&
        alert.timestamp - a.timestamp < 60000 // Within 1 minute
    );

    if (recentDuplicate) return;

    this.alerts.push(alert);

    // Keep only recent alerts
    const oneHourAgo = Date.now() - 3600000;
    this.alerts = this.alerts.filter(a => a.timestamp > oneHourAgo);
  }

  /**
   * Get current resource status
   */
  getResourceStatus(): {
    current: ResourceMetrics | null;
    recentAlerts: ResourceAlert[];
    health: 'healthy' | 'warning' | 'critical';
  } {
    const current = this.metrics[this.metrics.length - 1] || null;
    const recentAlerts = this.alerts.filter(
      a => Date.now() - a.timestamp < 300000 // Last 5 minutes
    );

    const hasCritical = recentAlerts.some(a => a.severity === 'critical');
    const hasWarning = recentAlerts.some(a => a.severity === 'warning');

    const health = hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy';

    return {
      current,
      recentAlerts,
      health,
    };
  }

  /**
   * Get historical metrics for trending
   */
  getHistoricalMetrics(duration: number = 600000): ResourceMetrics[] {
    const cutoff = Date.now() - duration;
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get average metrics over time period
   */
  getAverageMetrics(duration: number = 600000): Partial<ResourceMetrics> {
    const metrics = this.getHistoricalMetrics(duration);
    if (metrics.length === 0) return {};

    const sum = metrics.reduce(
      (acc, m) => ({
        memory: acc.memory + m.memory.percentage,
        cpu: acc.cpu + m.cpu.usage,
        requests: acc.requests + m.application.requestsPerSecond,
        errors: acc.errors + m.application.errorRate,
      }),
      { memory: 0, cpu: 0, requests: 0, errors: 0 }
    );

    const count = metrics.length;
    return {
      memory: {
        usedMB: 0,
        limitMB: 0,
        percentage: sum.memory / count,
      },
      cpu: {
        usage: sum.cpu / count,
        available: 100 - sum.cpu / count,
      },
      application: {
        activeUsers: 0,
        requestsPerSecond: sum.requests / count,
        errorRate: sum.errors / count,
      },
    } as Partial<ResourceMetrics>;
  }

  /**
   * Cleanup and stop monitoring
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.metrics = [];
    this.alerts = [];
  }
}

export const resourceMonitoringService = new ResourceMonitoringService();
