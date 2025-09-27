import { supabase } from '@/integrations/supabase/client';

export interface AlertRule {
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
  last_triggered?: string;
}

export interface ActiveAlert {
  id: string;
  rule_id: string;
  rule_name: string;
  severity: string;
  message: string;
  triggered_at: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  current_value: number;
  threshold: number;
  metadata?: Record<string, any>;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
  created_at: string;
}

export interface CreateAlertRule {
  name: string;
  description: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notification_channels: string[];
  cooldown_minutes: number;
}

export class AlertService {
  static async getAlertRules(): Promise<AlertRule[]> {
    try {
      // In a real implementation, this would fetch from a dedicated alerts table
      // For now, we'll return mock data representing typical alert rules
      return [
        {
          id: 'rule-1',
          name: 'High CPU Usage',
          description: 'Alert when CPU usage exceeds 80%',
          metric: 'cpu_usage',
          condition: 'greater_than',
          threshold: 80,
          severity: 'high',
          enabled: true,
          notification_channels: ['email-1', 'slack-1'],
          cooldown_minutes: 15,
          created_at: new Date().toISOString(),
          last_triggered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'rule-2',
          name: 'High Memory Usage',
          description: 'Alert when memory usage exceeds 90%',
          metric: 'memory_usage',
          condition: 'greater_than',
          threshold: 90,
          severity: 'critical',
          enabled: true,
          notification_channels: ['email-1', 'sms-1'],
          cooldown_minutes: 10,
          created_at: new Date().toISOString()
        },
        {
          id: 'rule-3',
          name: 'High Error Rate',
          description: 'Alert when error rate exceeds 5%',
          metric: 'error_rate',
          condition: 'greater_than',
          threshold: 5,
          severity: 'medium',
          enabled: true,
          notification_channels: ['slack-1'],
          cooldown_minutes: 30,
          created_at: new Date().toISOString()
        },
        {
          id: 'rule-4',
          name: 'Low Success Rate',
          description: 'Alert when swap success rate falls below 95%',
          metric: 'swap_success_rate',
          condition: 'less_than',
          threshold: 95,
          severity: 'high',
          enabled: false,
          notification_channels: ['email-1', 'webhook-1'],
          cooldown_minutes: 20,
          created_at: new Date().toISOString()
        }
      ];
    } catch (error) {
      console.error('Error fetching alert rules:', error);
      throw error;
    }
  }

  static async getActiveAlerts(): Promise<ActiveAlert[]> {
    try {
      // Check for any current security events that should be alerts
      const { data: securityEvents, error: securityError } = await supabase
        .from('real_time_security_events')
        .select('*')
        .eq('resolved', false)
        .order('detected_at', { ascending: false })
        .limit(10);

      if (securityError) {
        console.error('Error fetching security events:', securityError);
      }

      const alerts: ActiveAlert[] = [];

      // Convert security events to alerts
      securityEvents?.forEach(event => {
        alerts.push({
          id: event.id,
          rule_id: 'security-rule',
          rule_name: `Security: ${event.event_type}`,
          severity: event.severity,
          message: `Security event detected: ${event.event_type}`,
          triggered_at: event.detected_at || event.created_at,
          acknowledged: false,
          resolved: event.resolved,
          current_value: 1,
          threshold: 0,
          metadata: event.event_data as Record<string, any> || {}
        });
      });

      // Add mock system alerts based on current conditions
      const mockAlerts: ActiveAlert[] = [
        {
          id: 'alert-cpu-1',
          rule_id: 'rule-1',
          rule_name: 'High CPU Usage',
          severity: 'high',
          message: 'CPU usage has exceeded 85% for more than 5 minutes',
          triggered_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          acknowledged: false,
          resolved: false,
          current_value: 87.5,
          threshold: 80,
          metadata: { server: 'app-server-1', duration: '15m' }
        }
      ];

      // Randomly include mock alerts for demonstration
      if (Math.random() > 0.7) {
        alerts.push(...mockAlerts);
      }

      return alerts;
    } catch (error) {
      console.error('Error fetching active alerts:', error);
      return [];
    }
  }

  static async getNotificationChannels(): Promise<NotificationChannel[]> {
    try {
      // In a real implementation, this would fetch from a notification_channels table
      return [
        {
          id: 'email-1',
          name: 'Admin Email',
          type: 'email',
          config: { recipients: ['admin@aurum.com'] },
          enabled: true,
          created_at: new Date().toISOString()
        },
        {
          id: 'slack-1',
          name: 'Ops Slack Channel',
          type: 'slack',
          config: { webhook_url: 'https://hooks.slack.com/...', channel: '#ops-alerts' },
          enabled: true,
          created_at: new Date().toISOString()
        },
        {
          id: 'sms-1',
          name: 'Emergency SMS',
          type: 'sms',
          config: { phone_numbers: ['+1234567890'] },
          enabled: false,
          created_at: new Date().toISOString()
        },
        {
          id: 'webhook-1',
          name: 'PagerDuty Webhook',
          type: 'webhook',
          config: { url: 'https://events.pagerduty.com/integration/...', method: 'POST' },
          enabled: true,
          created_at: new Date().toISOString()
        }
      ];
    } catch (error) {
      console.error('Error fetching notification channels:', error);
      throw error;
    }
  }

  static async createAlertRule(rule: CreateAlertRule): Promise<string> {
    try {
      // In a real implementation, this would insert into an alert_rules table
      console.log('Creating alert rule:', rule);
      
      // Simulate database insert
      const ruleId = `rule-${Date.now()}`;
      
      // Here you would typically:
      // 1. Validate the rule parameters
      // 2. Insert into the database
      // 3. Set up monitoring for the new rule
      
      return ruleId;
    } catch (error) {
      console.error('Error creating alert rule:', error);
      throw error;
    }
  }

  static async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    try {
      console.log('Updating alert rule:', ruleId, updates);
      
      // In a real implementation, this would update the database
      // For now, we'll just log the operation
    } catch (error) {
      console.error('Error updating alert rule:', error);
      throw error;
    }
  }

  static async deleteAlertRule(ruleId: string): Promise<void> {
    try {
      console.log('Deleting alert rule:', ruleId);
      
      // In a real implementation, this would:
      // 1. Delete from the database
      // 2. Stop monitoring for this rule
      // 3. Clean up any related alerts
    } catch (error) {
      console.error('Error deleting alert rule:', error);
      throw error;
    }
  }

  static async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      // Check if this is a security event
      const { error } = await supabase
        .from('real_time_security_events')
        .update({ 
          resolved: false, // Just acknowledge, don't resolve yet
          event_data: { acknowledged: true, acknowledged_at: new Date().toISOString() }
        })
        .eq('id', alertId);

      if (error) {
        console.error('Error acknowledging security event:', error);
      }

      console.log('Alert acknowledged:', alertId);
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  static async resolveAlert(alertId: string): Promise<void> {
    try {
      // Check if this is a security event
      const { error } = await supabase
        .from('real_time_security_events')
        .update({ resolved: true })
        .eq('id', alertId);

      if (error) {
        console.error('Error resolving security event:', error);
      }

      console.log('Alert resolved:', alertId);
    } catch (error) {
      console.error('Error resolving alert:', error);
      throw error;
    }
  }

  static async triggerAlert(ruleId: string, currentValue: number, metadata?: Record<string, any>): Promise<void> {
    try {
      // This would be called by the monitoring system when a rule condition is met
      console.log('Triggering alert for rule:', ruleId, 'value:', currentValue);
      
      // In a real implementation, this would:
      // 1. Check cooldown period
      // 2. Create alert record
      // 3. Send notifications via configured channels
      // 4. Update rule's last_triggered timestamp
      
      // For security events, use the existing security event system
      if (ruleId.includes('security')) {
        await supabase.rpc('trigger_security_alert', {
          p_event_type: 'system_alert',
          p_severity: 'medium',
          p_event_data: { rule_id: ruleId, current_value: currentValue, ...metadata }
        });
      }
    } catch (error) {
      console.error('Error triggering alert:', error);
      throw error;
    }
  }

  static async testNotificationChannel(channelId: string): Promise<boolean> {
    try {
      console.log('Testing notification channel:', channelId);
      
      // In a real implementation, this would send a test notification
      // via the specified channel to verify it's working correctly
      
      return true;
    } catch (error) {
      console.error('Error testing notification channel:', error);
      return false;
    }
  }

  static async getAlertHistory(limit: number = 100): Promise<ActiveAlert[]> {
    try {
      // Fetch historical security events as alert history
      const { data: securityEvents, error } = await supabase
        .from('real_time_security_events')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return securityEvents?.map(event => ({
        id: event.id,
        rule_id: 'security-rule',
        rule_name: `Security: ${event.event_type}`,
        severity: event.severity,
        message: `Security event: ${event.event_type}`,
        triggered_at: event.detected_at || event.created_at,
        acknowledged: false, // Would need to track this separately
        resolved: event.resolved,
        current_value: 1,
        threshold: 0,
        metadata: event.event_data as Record<string, any> || {}
      })) || [];
    } catch (error) {
      console.error('Error fetching alert history:', error);
      return [];
    }
  }
}