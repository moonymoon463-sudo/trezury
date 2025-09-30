/**
 * Supabase Health Monitor
 * Monitors backend health and triggers automatic failover
 */

import { supabase } from '@/integrations/supabase/client';
import { circuitBreaker } from './circuitBreaker';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface HealthMetrics {
  status: HealthStatus;
  responseTime: number;
  consecutiveFailures: number;
  lastCheckTime: number;
  lastHealthyTime: number;
}

class SupabaseHealthMonitor {
  private metrics: HealthMetrics = {
    status: 'healthy',
    responseTime: 0,
    consecutiveFailures: 0,
    lastCheckTime: Date.now(),
    lastHealthyTime: Date.now(),
  };

  private checkInterval: number | null = null;
  private subscribers: Array<(status: HealthStatus) => void> = [];

  constructor() {
    this.startMonitoring();
  }

  startMonitoring(intervalMs = 30000) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = window.setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);

    // Initial check
    this.performHealthCheck();
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async performHealthCheck() {
    const startTime = Date.now();

    try {
      // Lightweight health check - just check auth session
      const { error } = await supabase.auth.getSession();
      const responseTime = Date.now() - startTime;

      this.metrics.responseTime = responseTime;
      this.metrics.lastCheckTime = Date.now();

      if (error) {
        this.recordFailure();
      } else {
        this.recordSuccess();
      }

      this.updateHealthStatus();
    } catch (error) {
      console.error('[Health Monitor] Check failed:', error);
      this.recordFailure();
      this.updateHealthStatus();
    }
  }

  private recordSuccess() {
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastHealthyTime = Date.now();

    // Reset circuit breakers on successful health check
    if (this.metrics.status !== 'healthy') {
      console.log('[Health Monitor] Backend recovered, resetting circuits');
      circuitBreaker.reset('supabase-main');
      circuitBreaker.reset('gold-price');
      circuitBreaker.reset('user-operations');
    }
  }

  private recordFailure() {
    this.metrics.consecutiveFailures++;
  }

  private updateHealthStatus() {
    const oldStatus = this.metrics.status;
    let newStatus: HealthStatus;

    const { responseTime, consecutiveFailures } = this.metrics;
    const timeSinceHealthy = Date.now() - this.metrics.lastHealthyTime;

    if (consecutiveFailures >= 3 || timeSinceHealthy > 120000) {
      newStatus = 'unhealthy';
      // Force open all circuits when unhealthy
      circuitBreaker.forceOpen('supabase-main');
      circuitBreaker.forceOpen('gold-price');
      circuitBreaker.forceOpen('user-operations');
    } else if (consecutiveFailures >= 1 || responseTime > 3000) {
      newStatus = 'degraded';
    } else {
      newStatus = 'healthy';
    }

    if (newStatus !== oldStatus) {
      console.log(`[Health Monitor] Status changed: ${oldStatus} -> ${newStatus}`);
      this.metrics.status = newStatus;
      this.notifySubscribers(newStatus);
    }
  }

  subscribe(callback: (status: HealthStatus) => void) {
    this.subscribers.push(callback);
    // Immediately notify with current status
    callback(this.metrics.status);

    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  private notifySubscribers(status: HealthStatus) {
    this.subscribers.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('[Health Monitor] Subscriber error:', error);
      }
    });
  }

  getMetrics(): HealthMetrics {
    return { ...this.metrics };
  }

  isHealthy(): boolean {
    return this.metrics.status === 'healthy';
  }

  isDegraded(): boolean {
    return this.metrics.status === 'degraded';
  }

  isUnhealthy(): boolean {
    return this.metrics.status === 'unhealthy';
  }

  forceCheck() {
    this.performHealthCheck();
  }
}

export const supabaseHealthMonitor = new SupabaseHealthMonitor();
