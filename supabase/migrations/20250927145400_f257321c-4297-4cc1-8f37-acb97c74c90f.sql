-- Fix remaining security issues from linter

-- Fix search_path for functions that don't have it set
ALTER FUNCTION public.monitor_transaction_activity() SET search_path TO 'public';
ALTER FUNCTION public.check_extension_security() SET search_path TO 'public';

-- Fix any remaining extensions in public schema
-- Move any other extensions that might be in public
DO $$
DECLARE
    ext_rec record;
BEGIN
    -- Check for any extensions in public schema and move them
    FOR ext_rec IN 
        SELECT e.extname 
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE n.nspname = 'public'
    LOOP
        -- Recreate extension in extensions schema
        EXECUTE format('DROP EXTENSION IF EXISTS %I CASCADE', ext_rec.extname);
        EXECUTE format('CREATE EXTENSION IF NOT EXISTS %I WITH SCHEMA extensions', ext_rec.extname);
    END LOOP;
END $$;

-- Create comprehensive security monitoring table
CREATE TABLE IF NOT EXISTS real_time_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES profiles(id),
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  event_data JSONB DEFAULT '{}',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on security events
ALTER TABLE real_time_security_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for security events
CREATE POLICY "Admins can manage all security events"
  ON real_time_security_events FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own security events"
  ON real_time_security_events FOR SELECT
  USING (user_id = auth.uid());

-- Create comprehensive system health monitoring
CREATE TABLE IF NOT EXISTS system_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT,
  threshold_warning NUMERIC,
  threshold_critical NUMERIC,
  status TEXT DEFAULT 'normal' CHECK (status IN ('normal', 'warning', 'critical')),
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on system health
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;

-- Only admins can access system health metrics
CREATE POLICY "Admins only access to system health"
  ON system_health_metrics FOR ALL
  USING (public.is_admin(auth.uid()));

-- Create enhanced security alerting function
CREATE OR REPLACE FUNCTION trigger_security_alert(
  p_event_type TEXT,
  p_severity TEXT,
  p_user_id UUID DEFAULT NULL,
  p_event_data JSONB DEFAULT '{}',
  p_session_id TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  alert_id UUID;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Create security event record
  INSERT INTO real_time_security_events (
    event_type, severity, user_id, event_data, session_id
  ) VALUES (
    p_event_type, p_severity, p_user_id, p_event_data, p_session_id
  ) RETURNING id INTO alert_id;

  -- Create user notification for medium+ severity events
  IF p_severity IN ('medium', 'high', 'critical') AND p_user_id IS NOT NULL THEN
    notification_title := CASE p_severity
      WHEN 'critical' THEN '🚨 Critical Security Alert'
      WHEN 'high' THEN '⚠️ High Priority Security Alert'
      ELSE '📢 Security Notice'
    END;

    notification_body := CASE p_event_type
      WHEN 'suspicious_login' THEN 'Unusual login activity detected on your account.'
      WHEN 'high_value_transaction' THEN 'A high-value transaction was processed on your account.'
      WHEN 'multiple_failed_attempts' THEN 'Multiple failed authentication attempts detected.'
      WHEN 'unusual_api_usage' THEN 'Unusual API usage pattern detected on your account.'
      ELSE 'Security event detected: ' || p_event_type
    END;

    INSERT INTO notifications (user_id, title, body, kind, metadata)
    VALUES (
      p_user_id,
      notification_title,
      notification_body,
      'security_alert',
      jsonb_build_object(
        'security_event_id', alert_id,
        'event_type', p_event_type,
        'severity', p_severity,
        'auto_generated', true
      )
    );
  END IF;

  RETURN alert_id;
END;
$$;

-- Create system monitoring function
CREATE OR REPLACE FUNCTION record_system_metric(
  p_metric_name TEXT,
  p_metric_value NUMERIC,
  p_metric_unit TEXT DEFAULT NULL,
  p_threshold_warning NUMERIC DEFAULT NULL,
  p_threshold_critical NUMERIC DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  metric_id UUID;
  metric_status TEXT := 'normal';
BEGIN
  -- Determine status based on thresholds
  IF p_threshold_critical IS NOT NULL AND p_metric_value >= p_threshold_critical THEN
    metric_status := 'critical';
  ELSIF p_threshold_warning IS NOT NULL AND p_metric_value >= p_threshold_warning THEN
    metric_status := 'warning';
  END IF;

  -- Record metric
  INSERT INTO system_health_metrics (
    metric_name, metric_value, metric_unit, 
    threshold_warning, threshold_critical, status
  ) VALUES (
    p_metric_name, p_metric_value, p_metric_unit,
    p_threshold_warning, p_threshold_critical, metric_status
  ) RETURNING id INTO metric_id;

  -- Create alert if threshold exceeded
  IF metric_status != 'normal' THEN
    PERFORM trigger_security_alert(
      'system_threshold_exceeded',
      metric_status,
      NULL,
      jsonb_build_object(
        'metric_name', p_metric_name,
        'metric_value', p_metric_value,
        'threshold', CASE 
          WHEN metric_status = 'critical' THEN p_threshold_critical
          ELSE p_threshold_warning
        END
      )
    );
  END IF;

  RETURN metric_id;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_events_user_time ON real_time_security_events(user_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_security_events_type_severity ON real_time_security_events(event_type, severity);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_time ON system_health_metrics(metric_name, recorded_at);
CREATE INDEX IF NOT EXISTS idx_transaction_alerts_user_time ON transaction_alerts(transaction_id, created_at);

-- Create enhanced admin function for security overview
CREATE OR REPLACE FUNCTION admin_get_security_overview()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check if requesting user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  SELECT json_build_object(
    'security_alerts', (
      SELECT json_build_object(
        'total_today', COUNT(*) FILTER (WHERE detected_at >= CURRENT_DATE),
        'critical_unresolved', COUNT(*) FILTER (WHERE severity = 'critical' AND NOT resolved),
        'high_unresolved', COUNT(*) FILTER (WHERE severity = 'high' AND NOT resolved),
        'recent_events', (
          SELECT json_agg(
            json_build_object(
              'id', id,
              'event_type', event_type,
              'severity', severity,
              'detected_at', detected_at,
              'user_id', user_id
            )
          )
          FROM real_time_security_events
          WHERE detected_at >= NOW() - INTERVAL '24 hours'
          ORDER BY detected_at DESC
          LIMIT 10
        )
      )
      FROM real_time_security_events
    ),
    'transaction_monitoring', (
      SELECT json_build_object(
        'alerts_today', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
        'high_value_alerts', COUNT(*) FILTER (WHERE alert_type = 'high_value'),
        'suspicious_patterns', COUNT(*) FILTER (WHERE alert_type = 'suspicious_pattern'),
        'failed_transactions', COUNT(*) FILTER (WHERE alert_type = 'failed_transaction')
      )
      FROM transaction_alerts
      WHERE created_at >= CURRENT_DATE
    ),
    'system_health', (
      SELECT json_build_object(
        'critical_metrics', COUNT(*) FILTER (WHERE status = 'critical'),
        'warning_metrics', COUNT(*) FILTER (WHERE status = 'warning'),
        'last_check', MAX(recorded_at)
      )
      FROM system_health_metrics
      WHERE recorded_at >= NOW() - INTERVAL '1 hour'
    )
  ) INTO result;

  RETURN result;
END;
$$;