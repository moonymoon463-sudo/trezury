-- CRITICAL SECURITY FIXES: Comprehensive PII Protection & Monitoring
-- This migration implements Priority 1, 2, and 3 security enhancements

-- ============================================================================
-- PART 1: SIMPLIFIED RLS POLICIES (CRITICAL)
-- ============================================================================

-- Drop the complex RLS policy and replace with simpler, more robust policies
DROP POLICY IF EXISTS "Enhanced user profile access" ON public.profiles;

-- Create simplified, auditable RLS policies
CREATE POLICY "Users can view own profile with rate limiting"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  AND check_pii_rate_limit(auth.uid())
);

CREATE POLICY "Users can update own profile with validation"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND check_pii_rate_limit(auth.uid())
);

-- ============================================================================
-- PART 2: AUTOMATIC PII ENCRYPTION (CRITICAL)
-- ============================================================================

-- Function to automatically encrypt PII on insert/update
CREATE OR REPLACE FUNCTION public.auto_encrypt_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Get encryption key from environment
  encryption_key := current_setting('app.settings.pii_encryption_key', true);
  
  -- Only encrypt if key is available and fields are not null
  IF encryption_key IS NOT NULL THEN
    -- Encrypt SSN if provided and not already encrypted
    IF NEW.ssn_last_four IS NOT NULL AND NEW.ssn_encrypted IS NULL THEN
      NEW.ssn_encrypted := pgcrypto.encrypt(
        NEW.ssn_last_four::bytea,
        encryption_key::bytea,
        'aes'
      );
    END IF;
    
    -- Encrypt DOB if provided and not already encrypted
    IF NEW.date_of_birth IS NOT NULL AND NEW.dob_encrypted IS NULL THEN
      NEW.dob_encrypted := pgcrypto.encrypt(
        NEW.date_of_birth::text::bytea,
        encryption_key::bytea,
        'aes'
      );
    END IF;
    
    -- Update encryption metadata
    NEW.encryption_metadata := jsonb_set(
      COALESCE(NEW.encryption_metadata, '{}'::jsonb),
      '{encrypted_at}',
      to_jsonb(now())
    );
    
    NEW.encryption_metadata := jsonb_set(
      NEW.encryption_metadata,
      '{encryption_version}',
      '"v2"'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic encryption
DROP TRIGGER IF EXISTS auto_encrypt_pii_trigger ON public.profiles;
CREATE TRIGGER auto_encrypt_pii_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_encrypt_pii();

-- ============================================================================
-- PART 3: ENHANCED RATE LIMITING (CRITICAL)
-- ============================================================================

-- Strengthen the rate limiting function with stricter limits
CREATE OR REPLACE FUNCTION public.check_pii_rate_limit(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  window_start timestamptz;
  suspicious_threshold integer := 15; -- Reduced from 30
BEGIN
  -- Get current rate limit status
  SELECT access_count, pii_access_rate_limit.window_start 
  INTO current_count, window_start
  FROM pii_access_rate_limit 
  WHERE user_id = user_uuid;
  
  -- If no record exists or window expired (30 minutes instead of 1 hour)
  IF current_count IS NULL OR window_start < (now() - interval '30 minutes') THEN
    INSERT INTO pii_access_rate_limit (user_id, access_count, window_start)
    VALUES (user_uuid, 1, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET access_count = 1, window_start = now();
    RETURN true;
  END IF;
  
  -- Check if under stricter limit (15 per 30 minutes)
  IF current_count < suspicious_threshold THEN
    UPDATE pii_access_rate_limit 
    SET access_count = access_count + 1 
    WHERE user_id = user_uuid;
    RETURN true;
  END IF;
  
  -- Over limit - create security alert
  INSERT INTO security_alerts (
    alert_type,
    severity,
    title,
    description,
    user_id,
    metadata
  ) VALUES (
    'rate_limit_exceeded',
    'high',
    'PII Access Rate Limit Exceeded',
    'User exceeded PII access rate limit - possible data scraping attempt',
    user_uuid,
    jsonb_build_object(
      'access_count', current_count,
      'window_start', window_start,
      'threshold', suspicious_threshold
    )
  );
  
  RETURN false;
END;
$$;

-- ============================================================================
-- PART 4: REAL-TIME SECURITY MONITORING (MODERATE)
-- ============================================================================

-- Function to detect and alert on suspicious PII access patterns
CREATE OR REPLACE FUNCTION public.monitor_pii_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  access_count_5min integer;
  access_count_15min integer;
  different_fields_accessed integer;
BEGIN
  -- Count recent accesses in last 5 minutes
  SELECT COUNT(*) INTO access_count_5min
  FROM audit_log
  WHERE user_id = auth.uid()
    AND table_name = 'profiles'
    AND operation IN ('SELECT', 'MASKED_PROFILE_ACCESS')
    AND timestamp > (NOW() - INTERVAL '5 minutes');
  
  -- Count accesses in last 15 minutes
  SELECT COUNT(*) INTO access_count_15min
  FROM audit_log
  WHERE user_id = auth.uid()
    AND table_name = 'profiles'
    AND timestamp > (NOW() - INTERVAL '15 minutes');
  
  -- Detect rapid access pattern (>10 in 5 minutes)
  IF access_count_5min > 10 THEN
    INSERT INTO security_alerts (
      alert_type,
      severity,
      title,
      description,
      user_id,
      metadata
    ) VALUES (
      'rapid_pii_access',
      'critical',
      'Rapid PII Access Detected',
      'Unusually rapid access to personal information detected',
      auth.uid(),
      jsonb_build_object(
        'access_count_5min', access_count_5min,
        'access_count_15min', access_count_15min,
        'detection_time', now()
      )
    );
  END IF;
  
  -- Detect sustained access pattern (>20 in 15 minutes)
  IF access_count_15min > 20 THEN
    INSERT INTO security_alerts (
      alert_type,
      severity,
      title,
      description,
      user_id,
      metadata
    ) VALUES (
      'sustained_pii_access',
      'high',
      'Sustained PII Access Pattern',
      'Sustained high-frequency access to personal information',
      auth.uid(),
      jsonb_build_object(
        'access_count_15min', access_count_15min,
        'detection_time', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for real-time monitoring
DROP TRIGGER IF EXISTS monitor_pii_access_trigger ON public.profiles;
CREATE TRIGGER monitor_pii_access_trigger
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.monitor_pii_access();

-- ============================================================================
-- PART 5: INPUT VALIDATION & SANITIZATION (MODERATE)
-- ============================================================================

-- Function to validate profile updates
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate email format
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  -- Validate phone number (basic format check)
  IF NEW.phone IS NOT NULL AND LENGTH(regexp_replace(NEW.phone, '[^0-9]', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Invalid phone number format';
  END IF;
  
  -- Validate SSN last 4 (must be exactly 4 digits)
  IF NEW.ssn_last_four IS NOT NULL AND NEW.ssn_last_four !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'SSN last four must be exactly 4 digits';
  END IF;
  
  -- Validate date of birth (must be in past and user must be at least 18)
  IF NEW.date_of_birth IS NOT NULL THEN
    IF NEW.date_of_birth > CURRENT_DATE THEN
      RAISE EXCEPTION 'Date of birth cannot be in the future';
    END IF;
    
    IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years') THEN
      RAISE EXCEPTION 'User must be at least 18 years old';
    END IF;
  END IF;
  
  -- Sanitize text fields (prevent XSS)
  NEW.first_name := regexp_replace(COALESCE(NEW.first_name, ''), '[<>]', '', 'g');
  NEW.last_name := regexp_replace(COALESCE(NEW.last_name, ''), '[<>]', '', 'g');
  NEW.address := regexp_replace(COALESCE(NEW.address, ''), '[<>]', '', 'g');
  NEW.city := regexp_replace(COALESCE(NEW.city, ''), '[<>]', '', 'g');
  
  RETURN NEW;
END;
$$;

-- Create trigger for input validation
DROP TRIGGER IF EXISTS validate_profile_update_trigger ON public.profiles;
CREATE TRIGGER validate_profile_update_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile_update();

-- ============================================================================
-- PART 6: ADMIN ACCESS AUDIT (MODERATE)
-- ============================================================================

-- Function to log all admin actions
CREATE OR REPLACE FUNCTION public.audit_admin_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log admin access to any table
  IF is_admin(auth.uid()) THEN
    PERFORM log_high_risk_operation(
      'ADMIN_ACCESS',
      TG_TABLE_NAME,
      ARRAY['admin_privileged_operation'],
      5
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 7: SESSION SECURITY MONITORING (MODERATE)
-- ============================================================================

-- Create table for session security tracking
CREATE TABLE IF NOT EXISTS public.session_security (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  ip_address inet,
  user_agent text,
  device_fingerprint text,
  location jsonb,
  created_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now(),
  is_suspicious boolean DEFAULT false,
  risk_score integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS on session security
ALTER TABLE public.session_security ENABLE ROW LEVEL SECURITY;

-- RLS policy for session security
CREATE POLICY "Users can view own sessions"
ON public.session_security
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Function to detect unusual login patterns
CREATE OR REPLACE FUNCTION public.detect_unusual_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_ip inet;
  previous_location jsonb;
  risk_score integer := 0;
  risk_reasons text[] := ARRAY[]::text[];
BEGIN
  -- Get previous session info
  SELECT ip_address, location INTO previous_ip, previous_location
  FROM session_security
  WHERE user_id = NEW.user_id
    AND created_at < NEW.created_at
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Check for IP address change
  IF previous_ip IS NOT NULL AND previous_ip != NEW.ip_address THEN
    risk_score := risk_score + 20;
    risk_reasons := array_append(risk_reasons, 'IP address changed');
  END IF;
  
  -- Check for rapid location change
  IF previous_location IS NOT NULL AND 
     (previous_location->>'country') != (NEW.location->>'country') AND
     (NEW.created_at - (SELECT created_at FROM session_security 
                        WHERE user_id = NEW.user_id 
                        ORDER BY created_at DESC LIMIT 1 OFFSET 1)) < INTERVAL '1 hour' THEN
    risk_score := risk_score + 40;
    risk_reasons := array_append(risk_reasons, 'Impossible travel detected');
  END IF;
  
  -- Update risk score
  NEW.risk_score := risk_score;
  NEW.is_suspicious := risk_score >= 30;
  NEW.metadata := jsonb_set(
    COALESCE(NEW.metadata, '{}'::jsonb),
    '{risk_reasons}',
    to_jsonb(risk_reasons)
  );
  
  -- Create alert for high-risk sessions
  IF risk_score >= 30 THEN
    INSERT INTO security_alerts (
      alert_type,
      severity,
      title,
      description,
      user_id,
      metadata
    ) VALUES (
      'unusual_login',
      CASE WHEN risk_score >= 50 THEN 'critical' ELSE 'high' END,
      'Unusual Login Detected',
      'Login from unusual location or device detected',
      NEW.user_id,
      jsonb_build_object(
        'risk_score', risk_score,
        'risk_reasons', risk_reasons,
        'ip_address', NEW.ip_address,
        'device_fingerprint', NEW.device_fingerprint
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for unusual login detection
DROP TRIGGER IF EXISTS detect_unusual_login_trigger ON public.session_security;
CREATE TRIGGER detect_unusual_login_trigger
BEFORE INSERT ON public.session_security
FOR EACH ROW
EXECUTE FUNCTION public.detect_unusual_login();

-- ============================================================================
-- PART 8: SECURITY MONITORING DASHBOARD DATA
-- ============================================================================

-- Function to get security dashboard metrics
CREATE OR REPLACE FUNCTION public.get_security_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only allow admins to view security metrics
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  SELECT jsonb_build_object(
    'critical_alerts', (
      SELECT COUNT(*) FROM security_alerts 
      WHERE severity = 'critical' AND NOT resolved
    ),
    'high_alerts', (
      SELECT COUNT(*) FROM security_alerts 
      WHERE severity = 'high' AND NOT resolved
    ),
    'rate_limit_violations_24h', (
      SELECT COUNT(*) FROM security_alerts 
      WHERE alert_type = 'rate_limit_exceeded' 
        AND created_at > NOW() - INTERVAL '24 hours'
    ),
    'unusual_logins_24h', (
      SELECT COUNT(*) FROM security_alerts 
      WHERE alert_type = 'unusual_login' 
        AND created_at > NOW() - INTERVAL '24 hours'
    ),
    'suspicious_sessions', (
      SELECT COUNT(*) FROM session_security 
      WHERE is_suspicious = true 
        AND created_at > NOW() - INTERVAL '24 hours'
    ),
    'recent_pii_access', (
      SELECT COUNT(*) FROM audit_log 
      WHERE table_name = 'profiles' 
        AND timestamp > NOW() - INTERVAL '1 hour'
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_security_metrics IS 'Returns comprehensive security metrics for admin dashboard';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for faster security queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user_time ON public.audit_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_time ON public.audit_log(table_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_severity ON public.security_alerts(user_id, severity) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_session_security_user_activity ON public.session_security(user_id, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_session_security_suspicious ON public.session_security(is_suspicious, created_at DESC) WHERE is_suspicious = true;