/**
 * Production Health Monitoring Service
 * Tracks system health metrics and alerts on issues
 */

import { logger } from '@/utils/logger';
import { supabase } from '@/integrations/supabase/client';

export interface HealthMetric {
  name: string;
  value: number;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
  timestamp: Date;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  metrics: HealthMetric[];
  lastCheck: Date;
}

export class ProductionHealthService {
  private metrics = new Map<string, HealthMetric[]>();
  private readonly METRIC_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private readonly CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

  async recordMetric(name: string, value: number, threshold: number): Promise<void> {
    const status = this.calculateStatus(value, threshold, name);
    
    const metric: HealthMetric = {
      name,
      value,
      threshold,
      status,
      timestamp: new Date()
    };

    // Store in memory
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(metric);

    // Clean old metrics
    this.cleanOldMetrics(name);

    // Log if unhealthy
    if (status === 'critical') {
      logger.critical(`Health metric critical: ${name}`, { metric });
      await this.createAlert(name, value, threshold, 'critical');
    } else if (status === 'warning') {
      logger.warn(`Health metric warning: ${name}`, { metric });
    }

    // Record to database
    try {
      await supabase.from('system_health_metrics').insert({
        metric_name: name,
        metric_value: value,
        threshold_value: threshold,
        status,
        metadata: { recorded_by: 'frontend' }
      });
    } catch (error: any) {
      logger.error('Failed to record health metric to database', error);
    }
  }

  private calculateStatus(value: number, threshold: number, metricName: string): 'healthy' | 'warning' | 'critical' {
    // For success rate and similar (higher is better)
    if (metricName.includes('success_rate') || metricName.includes('uptime')) {
      if (value < threshold * 0.8) return 'critical';
      if (value < threshold * 0.9) return 'warning';
      return 'healthy';
    }
    
    // For error rates, response times (lower is better)
    if (metricName.includes('error') || metricName.includes('time') || metricName.includes('duration')) {
      if (value > threshold * 1.5) return 'critical';
      if (value > threshold * 1.2) return 'warning';
      return 'healthy';
    }

    // Default comparison
    return value <= threshold ? 'healthy' : 'critical';
  }

  private cleanOldMetrics(name: string): void {
    const metrics = this.metrics.get(name);
    if (!metrics) return;

    const cutoff = Date.now() - this.METRIC_WINDOW_MS;
    const filtered = metrics.filter(m => m.timestamp.getTime() > cutoff);
    this.metrics.set(name, filtered);
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const allMetrics: HealthMetric[] = [];
    let criticalCount = 0;
    let warningCount = 0;

    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length > 0) {
        const latest = metrics[metrics.length - 1];
        allMetrics.push(latest);
        
        if (latest.status === 'critical') criticalCount++;
        if (latest.status === 'warning') warningCount++;
      }
    }

    const overall = 
      criticalCount > 0 ? 'critical' :
      warningCount > 0 ? 'degraded' :
      'healthy';

    return {
      overall,
      metrics: allMetrics,
      lastCheck: new Date()
    };
  }

  private async createAlert(
    metricName: string,
    value: number,
    threshold: number,
    severity: 'warning' | 'critical'
  ): Promise<void> {
    try {
      await supabase.from('security_alerts').insert({
        alert_type: 'health_metric_threshold',
        severity,
        title: `Health Alert: ${metricName}`,
        description: `${metricName} is ${severity}: ${value} (threshold: ${threshold})`,
        metadata: {
          metric_name: metricName,
          value,
          threshold,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      logger.error('Failed to create health alert', error);
    }
  }

  // Predefined metric recording helpers
  async recordSwapSuccessRate(successRate: number): Promise<void> {
    await this.recordMetric('swap_success_rate', successRate, 95);
  }

  async recordAverageSettlementTime(timeMs: number): Promise<void> {
    await this.recordMetric('average_settlement_time_ms', timeMs, 5 * 60 * 1000);
  }

  async recordIdempotencyRejectionRate(rate: number): Promise<void> {
    await this.recordMetric('idempotency_rejection_rate', rate, 1);
  }

  async recordChainIdMismatchRate(rate: number): Promise<void> {
    await this.recordMetric('chain_id_mismatch_rate', rate, 0.1);
  }

  async recordTokenVerificationFailureRate(rate: number): Promise<void> {
    await this.recordMetric('token_verification_failure_rate', rate, 0.1);
  }

  async recordSlippageCapViolationRate(rate: number): Promise<void> {
    await this.recordMetric('slippage_cap_violation_rate', rate, 5);
  }

  async recordRPCFailureRate(rate: number): Promise<void> {
    await this.recordMetric('rpc_failure_rate', rate, 1);
  }
}

export const productionHealthService = new ProductionHealthService();
