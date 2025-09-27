-- Phase 1: Database Schema Security - Move extensions to proper schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Check and move extensions from public to extensions schema
-- Note: This is informational - actual extension moves require superuser privileges
-- But we can create the proper schema structure for future use

-- Phase 2: Enhanced Authentication Security Policies
-- Create table for tracking failed login attempts
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address INET,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT FALSE,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS on auth_attempts
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can manage auth attempts
CREATE POLICY "Service role manages auth attempts"
ON public.auth_attempts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create table for security configurations
CREATE TABLE IF NOT EXISTS public.security_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on security_config
ALTER TABLE public.security_config ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can manage security config
CREATE POLICY "Admins only access to security config"
ON public.security_config
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Insert default security configurations
INSERT INTO public.security_config (config_key, config_value) VALUES
('max_login_attempts', '{"value": 5, "window_minutes": 15}'),
('session_timeout_hours', '{"value": 24}'),
('password_min_length', '{"value": 12}'),
('require_mfa_for_admins', '{"value": true}'),
('rate_limit_requests_per_minute', '{"value": 60}')
ON CONFLICT (config_key) DO NOTHING;

-- Create enhanced security monitoring table
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Enable RLS on security_alerts
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for security alerts
CREATE POLICY "Admins can manage all security alerts"
ON public.security_alerts
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own security alerts"
ON public.security_alerts
FOR SELECT
USING (auth.uid() = user_id);

-- Create function to record login attempts
CREATE OR REPLACE FUNCTION public.record_auth_attempt(
  p_email TEXT,
  p_success BOOLEAN DEFAULT FALSE,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auth_attempts (email, success, ip_address, user_agent)
  VALUES (p_email, p_success, p_ip_address, p_user_agent);
  
  -- Check for suspicious patterns (multiple failures)
  IF NOT p_success THEN
    DECLARE
      recent_failures INTEGER;
    BEGIN
      SELECT COUNT(*) INTO recent_failures
      FROM public.auth_attempts
      WHERE email = p_email
        AND success = FALSE
        AND attempted_at > NOW() - INTERVAL '15 minutes';
      
      -- Create security alert for multiple failures
      IF recent_failures >= 3 THEN
        INSERT INTO public.security_alerts (
          alert_type, severity, title, description, metadata, ip_address, user_agent
        ) VALUES (
          'multiple_failed_logins',
          'high',
          'Multiple Failed Login Attempts',
          'Multiple failed login attempts detected for email: ' || p_email,
          jsonb_build_object(
            'email', p_email,
            'failure_count', recent_failures,
            'time_window', '15 minutes'
          ),
          p_ip_address,
          p_user_agent
        );
      END IF;
    END;
  END IF;
END;
$$;

-- Create function to check if account should be locked
CREATE OR REPLACE FUNCTION public.is_account_locked(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_failures INTEGER;
  max_attempts INTEGER;
BEGIN
  -- Get max attempts from config
  SELECT (config_value->>'value')::INTEGER INTO max_attempts
  FROM public.security_config
  WHERE config_key = 'max_login_attempts';
  
  IF max_attempts IS NULL THEN
    max_attempts := 5; -- Default
  END IF;
  
  -- Count recent failures
  SELECT COUNT(*) INTO recent_failures
  FROM public.auth_attempts
  WHERE email = p_email
    AND success = FALSE
    AND attempted_at > NOW() - INTERVAL '15 minutes';
  
  RETURN recent_failures >= max_attempts;
END;
$$;

-- Create function for enhanced security event logging
CREATE OR REPLACE FUNCTION public.log_security_event_enhanced(
  p_event_type TEXT,
  p_severity TEXT,
  p_title TEXT,
  p_description TEXT,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alert_id UUID;
BEGIN
  INSERT INTO public.security_alerts (
    alert_type, severity, title, description, user_id, metadata, ip_address, user_agent
  ) VALUES (
    p_event_type, p_severity, p_title, p_description, p_user_id, p_metadata, p_ip_address, p_user_agent
  ) RETURNING id INTO alert_id;
  
  -- For critical alerts, also log to audit
  IF p_severity = 'critical' THEN
    PERFORM public.log_high_risk_operation(
      p_event_type,
      'security_alerts',
      ARRAY['critical_security_event'],
      10 -- Max risk score
    );
  END IF;
  
  RETURN alert_id;
END;
$$;

-- Create comprehensive data validation triggers for sensitive tables
CREATE OR REPLACE FUNCTION public.validate_profile_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Email format validation
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format: %', NEW.email;
  END IF;
  
  -- Phone number validation (basic)
  IF NEW.phone IS NOT NULL AND LENGTH(REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Phone number must contain at least 10 digits';
  END IF;
  
  -- SSN last four validation
  IF NEW.ssn_last_four IS NOT NULL AND (LENGTH(NEW.ssn_last_four) != 4 OR NEW.ssn_last_four !~ '^[0-9]{4}$') THEN
    RAISE EXCEPTION 'SSN last four must be exactly 4 digits';
  END IF;
  
  -- Date of birth validation (must be at least 18 years old)
  IF NEW.date_of_birth IS NOT NULL AND NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'User must be at least 18 years old';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply validation trigger to profiles table
DROP TRIGGER IF EXISTS validate_profile_data_trigger ON public.profiles;
CREATE TRIGGER validate_profile_data_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_data();

-- Create function to monitor system health and create alerts
CREATE OR REPLACE FUNCTION public.monitor_system_health()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  db_size BIGINT;
  active_connections INTEGER;
  failed_transactions INTEGER;
BEGIN
  -- Monitor database size
  SELECT pg_database_size(current_database()) INTO db_size;
  
  -- Monitor active connections
  SELECT count(*) INTO active_connections
  FROM pg_stat_activity
  WHERE state = 'active';
  
  -- Monitor recent failed transactions (proxy via error logs)
  SELECT COUNT(*) INTO failed_transactions
  FROM public.security_alerts
  WHERE created_at > NOW() - INTERVAL '1 hour'
    AND severity IN ('high', 'critical');
  
  -- Record metrics
  PERFORM public.record_system_metric('database_size_bytes', db_size, 'bytes');
  PERFORM public.record_system_metric('active_connections', active_connections, 'count');
  PERFORM public.record_system_metric('recent_security_alerts', failed_transactions, 'count');
  
  -- Create alerts for concerning metrics
  IF active_connections > 50 THEN
    PERFORM public.log_security_event_enhanced(
      'high_connection_count',
      'medium',
      'High Database Connection Count',
      'Unusual number of active database connections: ' || active_connections,
      NULL,
      jsonb_build_object('connection_count', active_connections)
    );
  END IF;
  
  IF failed_transactions > 10 THEN
    PERFORM public.log_security_event_enhanced(
      'high_error_rate',
      'high',
      'High Security Alert Rate',
      'High number of security alerts in the past hour: ' || failed_transactions,
      NULL,
      jsonb_build_object('alert_count', failed_transactions, 'time_window', '1 hour')
    );
  END IF;
END;
$$;