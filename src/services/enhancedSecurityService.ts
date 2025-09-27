import { supabase } from '@/integrations/supabase/client';

interface SecurityEvent {
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  user_id?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

interface AuthAttempt {
  email: string;
  success: boolean;
  ip_address?: string;
  user_agent?: string;
}

interface SecurityConfig {
  max_login_attempts: number;
  session_timeout_hours: number;
  password_min_length: number;
  require_mfa_for_admins: boolean;
  rate_limit_requests_per_minute: number;
}

class EnhancedSecurityService {
  private static instance: EnhancedSecurityService;
  private config: SecurityConfig | null = null;

  public static getInstance(): EnhancedSecurityService {
    if (!EnhancedSecurityService.instance) {
      EnhancedSecurityService.instance = new EnhancedSecurityService();
    }
    return EnhancedSecurityService.instance;
  }

  async getSecurityConfig(): Promise<SecurityConfig> {
    if (this.config) return this.config;

    try {
      const { data, error } = await supabase
        .from('security_config')
        .select('config_key, config_value');

      if (error) throw error;

      const configObj: any = {};
      data?.forEach(item => {
        const configValue = item.config_value as any;
        configObj[item.config_key] = configValue?.value;
      });

      this.config = {
        max_login_attempts: configObj.max_login_attempts || 5,
        session_timeout_hours: configObj.session_timeout_hours || 24,
        password_min_length: configObj.password_min_length || 12,
        require_mfa_for_admins: configObj.require_mfa_for_admins || false,
        rate_limit_requests_per_minute: configObj.rate_limit_requests_per_minute || 60
      };

      return this.config;
    } catch (error) {
      console.error('Failed to load security config:', error);
      // Return default config
      this.config = {
        max_login_attempts: 5,
        session_timeout_hours: 24,
        password_min_length: 12,
        require_mfa_for_admins: false,
        rate_limit_requests_per_minute: 60
      };
      return this.config;
    }
  }

  async logSecurityEvent(event: SecurityEvent): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('security-monitor', {
        body: {
          action: 'log_event',
          ...event
        }
      });

      if (error) {
        console.error('Failed to log security event:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error logging security event:', error);
      return false;
    }
  }

  async recordAuthAttempt(attempt: AuthAttempt): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('record_auth_attempt', {
        p_email: attempt.email,
        p_success: attempt.success,
        p_ip_address: attempt.ip_address,
        p_user_agent: attempt.user_agent
      });

      if (error) {
        console.error('Failed to record auth attempt:', error);
        return false;
      }

      // Also log as security event for high visibility
      await this.logSecurityEvent({
        event_type: attempt.success ? 'successful_login' : 'failed_login',
        severity: attempt.success ? 'low' : 'medium',
        title: attempt.success ? 'Successful Login' : 'Failed Login Attempt',
        description: `${attempt.success ? 'User logged in' : 'Failed login attempt'} for email: ${attempt.email}`,
        metadata: {
          email: attempt.email,
          ip_address: attempt.ip_address,
          user_agent: attempt.user_agent
        }
      });

      return true;
    } catch (error) {
      console.error('Error recording auth attempt:', error);
      return false;
    }
  }

  async checkAccountLocked(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_account_locked', {
        p_email: email
      });

      if (error) {
        console.error('Failed to check account lock status:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Error checking account lock status:', error);
      return false;
    }
  }

  async analyzeUserActivity(userId: string, activity: string): Promise<void> {
    try {
      await supabase.functions.invoke('security-monitor', {
        body: {
          action: 'analyze_activity',
          user_id: userId,
          activity,
          timestamp: new Date().toISOString(),
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent
        }
      });
    } catch (error) {
      console.error('Error analyzing user activity:', error);
    }
  }

  async validatePasswordStrength(password: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const config = await this.getSecurityConfig();

    if (password.length < config.password_min_length) {
      errors.push(`Password must be at least ${config.password_min_length} characters long`);
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check against common passwords (simplified check)
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty', 'letmein'
    ];
    
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      errors.push('Password contains common words or patterns');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async getSecurityAlerts(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get security alerts:', error);
      return [];
    }
  }

  async resolveSecurityAlert(alertId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', alertId);

      return !error;
    } catch (error) {
      console.error('Failed to resolve security alert:', error);
      return false;
    }
  }

  async createSecurityIncident(incident: {
    incident_type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('security_incidents')
        .insert([{
          ...incident,
          user_id: (await supabase.auth.getUser()).data.user?.id
        }])
        .select('id')
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.error('Failed to create security incident:', error);
      return null;
    }
  }

  async monitorSystemHealth(): Promise<void> {
    try {
      await supabase.rpc('monitor_system_health');
    } catch (error) {
      console.error('Failed to monitor system health:', error);
    }
  }

  private async getClientIP(): Promise<string | null> {
    try {
      // This is a simplified approach - in production you'd want more robust IP detection
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get client IP:', error);
      return null;
    }
  }

  // Real-time security monitoring
  setupRealTimeMonitoring(userId: string): () => void {
    const channel = supabase.channel('security-monitoring')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'security_alerts',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        this.handleSecurityAlert(payload.new);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  private handleSecurityAlert(alert: any): void {
    // Handle real-time security alerts
    if (alert.severity === 'critical' || alert.severity === 'high') {
      // Show immediate notification to user
      this.showSecurityNotification(alert);
    }
  }

  private showSecurityNotification(alert: any): void {
    // This could integrate with your notification system
    console.warn(`Security Alert: ${alert.title}`, alert);
    
    // You could dispatch a custom event or update a global state
    window.dispatchEvent(new CustomEvent('security-alert', {
      detail: alert
    }));
  }
}

export const enhancedSecurityService = EnhancedSecurityService.getInstance();