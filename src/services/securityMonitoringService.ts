import { supabase } from "@/integrations/supabase/client";

export interface SecurityEvent {
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  user_id?: string;
  session_id?: string;
  event_data?: Record<string, any>;
}

export interface TransactionAlert {
  id: string;
  transaction_id: string;
  alert_type: string;
  severity: string;
  description: string;
  metadata: Record<string, any>;
  resolved: boolean;
  created_at: string;
}

export interface SystemHealthMetric {
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  threshold_warning?: number;
  threshold_critical?: number;
  status: 'normal' | 'warning' | 'critical';
  recorded_at: string;
}

class SecurityMonitoringService {
  // Log security event
  async logSecurityEvent({
    event_type,
    severity = 'medium',
    user_id,
    session_id,
    event_data = {}
  }: SecurityEvent): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('trigger_security_alert', {
        p_event_type: event_type,
        p_severity: severity,
        p_user_id: user_id || null,
        p_event_data: event_data,
        p_session_id: session_id || null
      });

      if (error) {
        console.error('Failed to log security event:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Security event logging error:', err);
      return null;
    }
  }

  // Get user's security events
  async getUserSecurityEvents(limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('real_time_security_events')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch security events:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Get security events error:', err);
      return [];
    }
  }

  // Get transaction alerts
  async getTransactionAlerts(resolved?: boolean): Promise<any[]> {
    try {
      let query = supabase
        .from('transaction_alerts')
        .select(`
          id,
          transaction_id,
          alert_type,
          severity,
          description,
          metadata,
          resolved,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (resolved !== undefined) {
        query = query.eq('resolved', resolved);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch transaction alerts:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Get transaction alerts error:', err);
      return [];
    }
  }

  // Record system metric (admin only)
  async recordSystemMetric({
    metric_name,
    metric_value,
    metric_unit,
    threshold_warning,
    threshold_critical
  }: {
    metric_name: string;
    metric_value: number;
    metric_unit?: string;
    threshold_warning?: number;
    threshold_critical?: number;
  }): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('record_system_metric', {
        p_metric_name: metric_name,
        p_metric_value: metric_value,
        p_metric_unit: metric_unit || null,
        p_threshold_warning: threshold_warning || null,
        p_threshold_critical: threshold_critical || null
      });

      if (error) {
        console.error('Failed to record system metric:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Record system metric error:', err);
      return null;
    }
  }

  // Get security overview (admin only)
  async getSecurityOverview(): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('admin_get_security_overview');

      if (error) {
        console.error('Failed to get security overview:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Get security overview error:', err);
      return null;
    }
  }

  // Monitor high-value transactions
  async monitorTransaction(transactionId: string, amount: number, asset: string) {
    const eventData = {
      transaction_id: transactionId,
      amount,
      asset,
      timestamp: new Date().toISOString()
    };

    // Log high-value transaction monitoring
    if (amount > 10000) {
      await this.logSecurityEvent({
        event_type: 'high_value_transaction',
        severity: 'high',
        event_data: eventData
      });
    }

    // Check for suspicious patterns (multiple rapid transactions)
    const recentTransactions = await this.getRecentTransactionCount();
    if (recentTransactions > 5) {
      await this.logSecurityEvent({
        event_type: 'rapid_transaction_pattern',
        severity: 'medium',
        event_data: {
          ...eventData,
          recent_transaction_count: recentTransactions
        }
      });
    }
  }

  // Helper to get recent transaction count
  private async getRecentTransactionCount(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('created_at', fiveMinutesAgo);

      if (error) {
        console.error('Failed to count recent transactions:', error);
        return 0;
      }

      return count || 0;
    } catch (err) {
      console.error('Get recent transaction count error:', err);
      return 0;
    }
  }

  // Monitor authentication events
  async monitorAuthEvent(eventType: 'login' | 'logout' | 'failed_login', metadata?: Record<string, any>) {
    const severity = eventType === 'failed_login' ? 'medium' : 'low';
    
    await this.logSecurityEvent({
      event_type: `auth_${eventType}`,
      severity,
      event_data: {
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        ...metadata
      }
    });
  }

  // Set up real-time security monitoring
  setupRealTimeMonitoring(onAlert: (alert: any) => void) {
    const channel = supabase
      .channel('security-monitoring')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'real_time_security_events'
        },
        (payload) => {
          console.log('Security event detected:', payload);
          onAlert(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_alerts'
        },
        (payload) => {
          console.log('Transaction alert:', payload);
          onAlert(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const securityMonitoringService = new SecurityMonitoringService();