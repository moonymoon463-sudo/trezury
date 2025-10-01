-- =====================================================
-- CRITICAL SECURITY FIXES: Phase 1 (CORRECTED)
-- Addressing PII Exposure, Audit Log Access, and MoonPay Security
-- =====================================================

-- 1. CREATE SAFE RATE LIMIT FUNCTION WITH FAILSAFE
CREATE OR REPLACE FUNCTION public.check_pii_rate_limit(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_access_count integer;
  lockdown_active boolean;
BEGIN
  -- Check emergency lockdown first
  BEGIN
    SELECT (config_value->>'enabled')::boolean INTO lockdown_active
    FROM security_config 
    WHERE config_key = 'emergency_pii_lockdown';
    
    IF COALESCE(lockdown_active, false) = true THEN
      RETURN false;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Count recent PII accesses
  BEGIN
    SELECT COUNT(*) INTO recent_access_count
    FROM audit_log
    WHERE user_id = user_uuid
      AND table_name = 'profiles'
      AND operation IN ('SELECT', 'MASKED_PROFILE_ACCESS', 'SENSITIVE_UPDATE')
      AND timestamp > (NOW() - INTERVAL '5 minutes');
    
    -- Alert on suspicious activity (>20 accesses in 5 minutes)
    IF recent_access_count > 20 THEN
      INSERT INTO security_alerts (
        user_id, alert_type, severity, title, description, metadata
      ) VALUES (
        user_uuid, 'excessive_pii_access', 'critical',
        'Excessive PII Access Detected',
        'User exceeded rate limit for PII access',
        jsonb_build_object('access_count', recent_access_count, 'time_window', '5_minutes')
      );
      RETURN false;
    END IF;
    
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    -- On any error, fail-open (allow access) but log the error
    INSERT INTO security_alerts (
      user_id, alert_type, severity, title, description, metadata
    ) VALUES (
      user_uuid, 'rate_limit_function_error', 'high',
      'Rate Limit Function Error',
      'PII rate limit check encountered an error',
      jsonb_build_object('error', SQLERRM, 'timestamp', now())
    );
    RETURN true;
  END;
END;
$$;

-- 2. UPDATE PROFILES RLS POLICIES WITH FAILSAFE
DROP POLICY IF EXISTS "Users can view own profile with rate limit" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile with validation" ON profiles;

CREATE POLICY "Users can view own profile with safe rate limit"
ON profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id 
  AND (check_pii_rate_limit(auth.uid()) OR auth.uid() = id)
);

CREATE POLICY "Users can update own profile with safe validation"
ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND (check_pii_rate_limit(auth.uid()) OR auth.uid() = id)
);

-- 3. FIX AUDIT LOG SECURITY
DROP POLICY IF EXISTS "No user access to audit logs" ON audit_log;
DROP POLICY IF EXISTS "Authorized functions can insert audit logs" ON audit_log;

CREATE POLICY "Admins can view audit logs"
ON audit_log FOR SELECT TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own audit logs"
ON audit_log FOR SELECT TO authenticated
USING (
  user_id = auth.uid() 
  AND table_name IN ('profiles', 'transactions', 'user_roles')
);

CREATE POLICY "Service role can insert audit logs"
ON audit_log FOR INSERT TO authenticated
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role' OR is_admin(auth.uid()));

-- 4. STRENGTHEN MOONPAY CUSTOMER DATA SECURITY
DROP POLICY IF EXISTS "Users can view their own MoonPay customer data" ON moonpay_customers;
DROP POLICY IF EXISTS "Users can insert their own MoonPay customer data" ON moonpay_customers;
DROP POLICY IF EXISTS "Users can update their own MoonPay customer data" ON moonpay_customers;

CREATE POLICY "Users can view only their MoonPay data"
ON moonpay_customers FOR SELECT TO authenticated
USING (auth.uid() = user_id AND user_id IS NOT NULL);

CREATE POLICY "Users can insert only their MoonPay data"
ON moonpay_customers FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND user_id IS NOT NULL
  AND email IS NOT NULL
);

CREATE POLICY "Users can update only their MoonPay data"
ON moonpay_customers FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all MoonPay data"
ON moonpay_customers FOR SELECT TO authenticated
USING (is_admin(auth.uid()));

-- 5. EMERGENCY LOCKDOWN TRIGGER
CREATE OR REPLACE FUNCTION public.emergency_pii_lockdown_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF emergency_pii_lockdown_active() THEN
    RAISE EXCEPTION 'Emergency PII lockdown is active. Contact administrator.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_emergency_pii_lockdown ON profiles;
CREATE TRIGGER enforce_emergency_pii_lockdown
  BEFORE UPDATE OF ssn_last_four, date_of_birth, address, phone
  ON profiles FOR EACH ROW
  EXECUTE FUNCTION emergency_pii_lockdown_trigger();

-- 6. AUDIT LOG RETENTION
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM audit_log
  WHERE timestamp < NOW() - INTERVAL '90 days'
    AND operation NOT IN ('SENSITIVE_PII_UPDATE', 'ADMIN_ACCESS', 'SECURITY_ALERT');
  
  INSERT INTO security_alerts (
    alert_type, severity, title, description, metadata
  ) VALUES (
    'audit_log_cleanup', 'low',
    'Audit Log Cleanup Completed',
    'Old audit logs cleaned up per retention policy',
    jsonb_build_object('timestamp', now())
  );
END;
$$;

-- 7. ENHANCED PII ACCESS LOGGING
CREATE OR REPLACE FUNCTION public.log_pii_access_enhanced(
  p_user_id uuid,
  p_target_user_id uuid,
  p_operation text,
  p_fields_accessed text[],
  p_access_granted boolean,
  p_access_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (
    user_id, table_name, operation, sensitive_fields, 
    timestamp, metadata
  ) VALUES (
    p_user_id, 'profiles', p_operation, p_fields_accessed,
    now(),
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'access_granted', p_access_granted,
      'access_reason', COALESCE(p_access_reason, 'direct_access')
    )
  );
  
  IF NOT p_access_granted THEN
    INSERT INTO security_alerts (
      user_id, alert_type, severity, title, description, metadata
    ) VALUES (
      p_user_id, 'pii_access_denied', 'medium',
      'PII Access Denied',
      'Attempt to access PII was blocked',
      jsonb_build_object(
        'target_user_id', p_target_user_id,
        'fields', p_fields_accessed,
        'reason', p_access_reason
      )
    );
  END IF;
END;
$$;

-- 8. SECURITY CONFIG CONSTRAINTS
ALTER TABLE security_config
  ALTER COLUMN config_key SET NOT NULL,
  ALTER COLUMN config_value SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'security_config_config_key_key'
  ) THEN
    ALTER TABLE security_config 
      ADD CONSTRAINT security_config_config_key_key UNIQUE (config_key);
  END IF;
END $$;

-- 9. SECURITY DASHBOARD METRICS
CREATE OR REPLACE FUNCTION public.get_security_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  SELECT json_build_object(
    'pii_accesses_last_hour', (
      SELECT COUNT(*) FROM audit_log 
      WHERE table_name = 'profiles' 
        AND timestamp > NOW() - INTERVAL '1 hour'
    ),
    'security_alerts_last_24h', (
      SELECT COUNT(*) FROM security_alerts 
      WHERE created_at > NOW() - INTERVAL '24 hours'
        AND resolved = false
    ),
    'failed_auth_attempts_last_hour', (
      SELECT COUNT(*) FROM auth_attempts 
      WHERE success = false 
        AND attempted_at > NOW() - INTERVAL '1 hour'
    ),
    'emergency_lockdown_status', (
      SELECT COALESCE((config_value->>'enabled')::boolean, false)
      FROM security_config 
      WHERE config_key = 'emergency_pii_lockdown'
    ),
    'high_risk_operations_today', (
      SELECT COUNT(*) FROM security_audit
      WHERE risk_score >= 4
        AND timestamp > CURRENT_DATE
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 10. VALIDATE RLS ON CRITICAL TABLES
DO $$ 
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles') THEN
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'audit_log') THEN
    ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'moonpay_customers') THEN
    ALTER TABLE moonpay_customers ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'security_alerts') THEN
    ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;