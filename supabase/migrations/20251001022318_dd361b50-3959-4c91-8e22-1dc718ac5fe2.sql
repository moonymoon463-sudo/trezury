-- =====================================================
-- CRITICAL SECURITY FIXES (SIMPLIFIED)
-- =====================================================

-- Fix 1: Add SET search_path to functions missing it

CREATE OR REPLACE FUNCTION public.profiles_update_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sensitive_fields text[] := '{}';
BEGIN
  IF NEW.ssn_last_four IS DISTINCT FROM OLD.ssn_last_four THEN
    sensitive_fields := array_append(sensitive_fields, 'ssn_last_four');
  END IF;
  
  IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
    sensitive_fields := array_append(sensitive_fields, 'date_of_birth');
  END IF;
  
  IF NEW.address IS DISTINCT FROM OLD.address THEN
    sensitive_fields := array_append(sensitive_fields, 'address');
  END IF;
  
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    sensitive_fields := array_append(sensitive_fields, 'phone');
  END IF;
  
  IF array_length(sensitive_fields, 1) > 0 THEN
    PERFORM log_sensitive_access(
      'profiles',
      'UPDATE',
      sensitive_fields,
      jsonb_build_object(
        'user_id', NEW.id,
        'modified_at', now(),
        'kyc_status', NEW.kyc_status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  IF NEW.phone IS NOT NULL AND LENGTH(regexp_replace(NEW.phone, '[^0-9]', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Invalid phone number format';
  END IF;
  
  IF NEW.ssn_last_four IS NOT NULL AND NEW.ssn_last_four !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'SSN last four must be exactly 4 digits';
  END IF;
  
  IF NEW.date_of_birth IS NOT NULL THEN
    IF NEW.date_of_birth > CURRENT_DATE THEN
      RAISE EXCEPTION 'Date of birth cannot be in the future';
    END IF;
    
    IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years') THEN
      RAISE EXCEPTION 'User must be at least 18 years old';
    END IF;
  END IF;
  
  NEW.first_name := regexp_replace(COALESCE(NEW.first_name, ''), '[<>]', '', 'g');
  NEW.last_name := regexp_replace(COALESCE(NEW.last_name, ''), '[<>]', '', 'g');
  NEW.address := regexp_replace(COALESCE(NEW.address, ''), '[<>]', '', 'g');
  NEW.city := regexp_replace(COALESCE(NEW.city, ''), '[<>]', '', 'g');
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.monitor_transaction_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_transaction_count INTEGER;
  risk_score INTEGER := 0;
  alert_reasons TEXT[] := '{}';
BEGIN
  IF NEW.type IN ('buy', 'sell') AND (NEW.quantity * COALESCE(NEW.unit_price_usd, 0)) > 10000 THEN
    risk_score := risk_score + 30;
    alert_reasons := array_append(alert_reasons, 'High-value transaction');
  END IF;

  SELECT COUNT(*) INTO user_transaction_count
  FROM transactions 
  WHERE user_id = NEW.user_id 
    AND created_at > NOW() - INTERVAL '5 minutes';
    
  IF user_transaction_count > 5 THEN
    risk_score := risk_score + 40;
    alert_reasons := array_append(alert_reasons, 'Rapid transaction pattern');
  END IF;

  IF NEW.status = 'failed' THEN
    risk_score := risk_score + 20;
    alert_reasons := array_append(alert_reasons, 'Failed transaction');
  END IF;

  IF risk_score >= 30 THEN
    INSERT INTO security_alerts (
      user_id,
      alert_type,
      severity,
      title,
      description,
      metadata
    ) VALUES (
      NEW.user_id,
      'suspicious_transaction',
      CASE WHEN risk_score >= 50 THEN 'critical' ELSE 'high' END,
      'Suspicious Transaction Activity',
      array_to_string(alert_reasons, ', '),
      jsonb_build_object(
        'transaction_id', NEW.id,
        'risk_score', risk_score,
        'reasons', alert_reasons
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_admin_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION public.simple_profile_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.ssn_last_four IS DISTINCT FROM OLD.ssn_last_four OR
      NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth OR
      NEW.address IS DISTINCT FROM OLD.address OR
      NEW.phone IS DISTINCT FROM OLD.phone) THEN
    
    INSERT INTO audit_log (user_id, table_name, operation, timestamp, metadata)
    VALUES (
      auth.uid(),
      'profiles',
      'SENSITIVE_UPDATE',
      now(),
      jsonb_build_object('updated_fields', 'sensitive_data')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix 2: Enhanced masking function for email
CREATE OR REPLACE FUNCTION mask_email(email_value text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN email_value IS NULL THEN NULL
    WHEN email_value LIKE '%@%' THEN 
      substring(email_value from 1 for 2) || 
      '***@' || 
      split_part(email_value, '@', 2)
    ELSE '***@***.com'
  END;
$$;

-- Fix 3: Create emergency lockdown function
CREATE OR REPLACE FUNCTION emergency_pii_lockdown_active()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lockdown_status boolean := false;
BEGIN
  SELECT (config_value->>'enabled')::boolean
  INTO lockdown_status
  FROM security_config
  WHERE config_key = 'emergency_pii_lockdown';
  
  RETURN COALESCE(lockdown_status, false);
END;
$$;

-- Fix 4: Add security configuration
INSERT INTO security_config (config_key, config_value, created_by)
VALUES (
  'emergency_pii_lockdown',
  '{"enabled": false, "reason": "", "activated_at": null}'::jsonb,
  NULL
)
ON CONFLICT (config_key) DO NOTHING;

-- Add security documentation comments
COMMENT ON FUNCTION emergency_pii_lockdown_active IS 'Checks if emergency PII lockdown is active - blocks all PII access except for admins when enabled';
COMMENT ON FUNCTION mask_email IS 'Masks email addresses for display purposes (e.g., ab***@domain.com)';
COMMENT ON FUNCTION monitor_transaction_activity IS 'Monitors transaction patterns and creates security alerts for suspicious activity';
COMMENT ON FUNCTION audit_admin_access IS 'Logs all admin access to tables for security audit trail';