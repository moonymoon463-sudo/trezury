/**
 * DEX Fallback Service - 0x API Downtime Detection
 * ✅ PHASE 3: API DOWNTIME MONITORING
 */

import { supabase } from "@/integrations/supabase/client";

interface HealthCheckResult {
  available: boolean;
  latencyMs?: number;
  error?: string;
}

class DexFallbackService {
  private readonly HEALTH_CHECK_TIMEOUT_MS = 5000;
  private lastDowntime: Date | null = null;
  
  /**
   * Check if 0x API is available
   */
  async checkZeroXHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.HEALTH_CHECK_TIMEOUT_MS);
      
      // Simple health check - get USDC/XAUT price quote
      const response = await fetch(
        'https://api.0x.org/swap/v1/price?sellToken=USDC&buyToken=XAUT&sellAmount=1000000',
        {
          signal: controller.signal,
          headers: {
            '0x-api-key': import.meta.env.VITE_ZEROX_API_KEY || ''
          }
        }
      );
      
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        return {
          available: true,
          latencyMs: latency
        };
      } else {
        return {
          available: false,
          latencyMs: latency,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      
      return {
        available: false,
        latencyMs: latency,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Log downtime event to database
   */
  async logDowntime(error: any): Promise<void> {
    console.error('🚨 0x API Down:', error);
    
    try {
      // Store downtime event
      const { error: insertError } = await supabase
        .from('api_downtime_log')
        .insert({
          provider: '0x',
          error_message: error.message || 'API unavailable',
          error_details: {
            timestamp: new Date().toISOString(),
            error: error.toString(),
            stack: error.stack
          },
          detected_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Failed to log downtime:', insertError);
      }
      
      // Alert admins if downtime is new (>5 min since last)
      const shouldAlert = !this.lastDowntime || 
        (Date.now() - this.lastDowntime.getTime()) > 300000; // 5 minutes
      
      if (shouldAlert) {
        // Get admin users
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');
        
        if (admins && admins.length > 0) {
          // Create notifications for all admins
          const notifications = admins.map(admin => ({
            user_id: admin.user_id,
            title: '🚨 0x API Downtime',
            body: `0x gasless API is unavailable. Error: ${error.message || 'Unknown'}. Swaps may fail until resolved.`,
            kind: 'critical_alert',
            priority: 'critical'
          }));
          
          await supabase.from('notifications').insert(notifications);
        }
        
        this.lastDowntime = new Date();
      }
    } catch (logError) {
      console.error('Failed to log API downtime:', logError);
    }
  }
  
  /**
   * Resolve downtime event
   */
  async resolveDowntime(): Promise<void> {
    try {
      // Find most recent unresolved downtime
      const { data: unresolved } = await supabase
        .from('api_downtime_log')
        .select('id')
        .eq('provider', '0x')
        .is('resolved_at', null)
        .order('detected_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (unresolved) {
        await supabase
          .from('api_downtime_log')
          .update({ resolved_at: new Date().toISOString() })
          .eq('id', unresolved.id);
        
        console.log('✅ 0x API downtime resolved');
      }
    } catch (error) {
      console.error('Failed to resolve downtime:', error);
    }
  }
  
  /**
   * Monitor 0x API health continuously
   */
  async monitorHealth(): Promise<void> {
    const health = await this.checkZeroXHealth();
    
    if (!health.available) {
      await this.logDowntime(new Error(health.error || 'API unavailable'));
    } else {
      // Check if we need to resolve previous downtime
      if (this.lastDowntime) {
        await this.resolveDowntime();
        this.lastDowntime = null;
      }
    }
  }
  
  /**
   * Get recent downtime statistics
   */
  async getDowntimeStats(hours: number = 24): Promise<{
    totalDowntimeMinutes: number;
    incidentCount: number;
    currentlyDown: boolean;
  }> {
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    
    const { data: incidents } = await supabase
      .from('api_downtime_log')
      .select('detected_at, resolved_at, duration_seconds')
      .eq('provider', '0x')
      .gte('detected_at', since)
      .order('detected_at', { ascending: false });
    
    if (!incidents) {
      return { totalDowntimeMinutes: 0, incidentCount: 0, currentlyDown: false };
    }
    
    const totalSeconds = incidents.reduce((sum, inc) => 
      sum + (inc.duration_seconds || 0), 0
    );
    
    const currentlyDown = incidents.length > 0 && !incidents[0].resolved_at;
    
    return {
      totalDowntimeMinutes: Math.round(totalSeconds / 60),
      incidentCount: incidents.length,
      currentlyDown
    };
  }
}

export const dexFallbackService = new DexFallbackService();
