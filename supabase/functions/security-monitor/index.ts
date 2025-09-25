import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SecurityEvent {
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  session_id: string;
}

interface ActivityAnalysis {
  userId: string;
  activity: string;
  timestamp: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, event, userId, activity, timestamp } = await req.json();
    
    // Get client IP and user agent
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    switch (action) {
      case 'log_event':
        return await handleLogEvent(supabase, event, clientIP, userAgent);
      
      case 'analyze_activity':
        return await handleActivityAnalysis(supabase, { userId, activity, timestamp }, clientIP);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Security monitor error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleLogEvent(
  supabase: any, 
  event: SecurityEvent, 
  clientIP: string, 
  userAgent: string
) {
  try {
    // Enhanced event with client information
    const enhancedEvent = {
      ...event,
      ip_address: clientIP,
      user_agent: userAgent,
    };

    // Store in security_audit table
    const { error: auditError } = await supabase
      .from('security_audit')
      .insert({
        user_id: enhancedEvent.user_id,
        operation: enhancedEvent.event_type,
        table_name: 'security_events',
        sensitive_fields: null,
        risk_score: getSeverityScore(enhancedEvent.severity),
        metadata: {
          ...enhancedEvent.metadata,
          severity: enhancedEvent.severity,
          description: enhancedEvent.description,
          ip_address: clientIP,
          user_agent: userAgent,
          session_id: enhancedEvent.session_id,
          timestamp: enhancedEvent.timestamp
        }
      });

    if (auditError) {
      console.error('Failed to store security audit:', auditError);
    }

    // Check for critical events and trigger alerts
    if (enhancedEvent.severity === 'critical') {
      await triggerCriticalAlert(supabase, enhancedEvent);
    }

    // Check for suspicious patterns
    if (enhancedEvent.user_id) {
      await checkSuspiciousPatterns(supabase, enhancedEvent.user_id, enhancedEvent.event_type);
    }

    return new Response(
      JSON.stringify({ success: true, eventId: enhancedEvent.session_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Log event error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to log security event' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleActivityAnalysis(
  supabase: any, 
  analysis: ActivityAnalysis, 
  clientIP: string
) {
  try {
    const { userId, activity, timestamp } = analysis;
    let riskScore = 0;
    const reasons: string[] = [];
    
    // Check recent activity frequency
    const { data: recentActivity } = await supabase
      .from('security_audit')
      .select('metadata')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('created_at', { ascending: false });

    // High frequency activity detection
    if (recentActivity && recentActivity.length > 10) {
      riskScore += 30;
      reasons.push('High frequency activity detected');
    }

    // Check for activity from multiple IPs
    const uniqueIPs = new Set();
    recentActivity?.forEach((event: any) => {
      if (event.metadata?.ip_address) {
        uniqueIPs.add(event.metadata.ip_address);
      }
    });

    if (uniqueIPs.size > 3) {
      riskScore += 40;
      reasons.push('Activity from multiple IP addresses');
    }

    // Check for unusual activity patterns
    const sensitiveActions = ['wallet_connected', 'transaction_signed', 'withdrawal_initiated'];
    if (sensitiveActions.includes(activity)) {
      // Check if user typically performs this action
      const { data: historicalActivity } = await supabase
        .from('security_audit')
        .select('operation')
        .eq('user_id', userId)
        .eq('operation', activity)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      if (!historicalActivity || historicalActivity.length === 0) {
        riskScore += 20;
        reasons.push('Unusual activity for this user');
      }
    }

    // Time-based analysis
    const hour = new Date(timestamp).getHours();
    if (hour < 6 || hour > 22) { // Outside typical hours
      riskScore += 15;
      reasons.push('Activity outside typical hours');
    }

    // Geographic analysis (simplified)
    const { data: recentIPs } = await supabase
      .from('security_audit')
      .select('metadata')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .limit(10);

    const hasNewIP = !recentIPs?.some((event: any) => event.metadata?.ip_address === clientIP);
    if (hasNewIP && recentIPs && recentIPs.length > 0) {
      riskScore += 25;
      reasons.push('Activity from new IP address');
    }

    const isSuspicious = riskScore >= 50;

    // Log the analysis
    if (isSuspicious) {
      await supabase
        .from('security_audit')
        .insert({
          user_id: userId,
          operation: 'suspicious_activity_detected',
          table_name: 'security_analysis',
          risk_score: riskScore,
          metadata: {
            activity,
            risk_factors: reasons,
            ip_address: clientIP,
            analysis_timestamp: timestamp
          }
        });

      // Create notification for user if risk is high
      if (riskScore >= 70) {
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            title: 'Security Alert: Suspicious Activity',
            body: 'Unusual account activity detected. If this wasn\'t you, please secure your account immediately.',
            kind: 'security_alert',
            metadata: {
              risk_score: riskScore,
              reasons: reasons.slice(0, 3) // Limit to top 3 reasons
            }
          });
      }
    }

    return new Response(
      JSON.stringify({
        isSuspicious,
        riskScore,
        reasons
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Activity analysis error:', error);
    return new Response(
      JSON.stringify({ 
        isSuspicious: false, 
        riskScore: 0, 
        reasons: [],
        error: 'Analysis failed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function triggerCriticalAlert(supabase: any, event: SecurityEvent) {
  try {
    // Log critical alert
    console.error('🚨 CRITICAL SECURITY EVENT:', event);

    // Store critical alert
    await supabase
      .from('notifications')
      .insert({
        user_id: event.user_id,
        title: '🚨 Critical Security Alert',
        body: event.description,
        kind: 'critical_security',
        metadata: {
          event_type: event.event_type,
          severity: event.severity,
          session_id: event.session_id,
          requires_immediate_action: true
        }
      });

    // In production, you would also:
    // - Send email alerts
    // - Send SMS alerts
    // - Notify security team
    // - Temporarily lock account if needed
    
  } catch (error) {
    console.error('Failed to trigger critical alert:', error);
  }
}

async function checkSuspiciousPatterns(supabase: any, userId: string, eventType: string) {
  try {
    // Check for rapid succession of the same event
    const { data: recentSameEvents } = await supabase
      .from('security_audit')
      .select('created_at')
      .eq('user_id', userId)
      .eq('operation', eventType)
      .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()) // Last 2 minutes
      .order('created_at', { ascending: false });

    if (recentSameEvents && recentSameEvents.length > 5) {
      await supabase
        .from('security_audit')
        .insert({
          user_id: userId,
          operation: 'rapid_event_pattern',
          table_name: 'pattern_detection',
          risk_score: 60,
          metadata: {
            pattern_type: 'rapid_succession',
            event_type: eventType,
            count: recentSameEvents.length,
            detected_at: new Date().toISOString()
          }
        });
    }
  } catch (error) {
    console.error('Pattern detection error:', error);
  }
}

function getSeverityScore(severity: string): number {
  switch (severity) {
    case 'low': return 1;
    case 'medium': return 3;
    case 'high': return 7;
    case 'critical': return 10;
    default: return 1;
  }
}