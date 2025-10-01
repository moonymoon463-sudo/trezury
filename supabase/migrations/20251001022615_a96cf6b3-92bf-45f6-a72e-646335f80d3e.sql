-- =====================================================
-- CRITICAL SECURITY FIXES
-- =====================================================

-- Add SET search_path to all functions
CREATE OR REPLACE FUNCTION public.profiles_update_audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE sensitive_fields text[] := '{}'; BEGIN
  IF NEW.ssn_last_four IS DISTINCT FROM OLD.ssn_last_four THEN sensitive_fields := array_append(sensitive_fields, 'ssn_last_four'); END IF;
  IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN sensitive_fields := array_append(sensitive_fields, 'date_of_birth'); END IF;
  IF NEW.address IS DISTINCT FROM OLD.address THEN sensitive_fields := array_append(sensitive_fields, 'address'); END IF;
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN sensitive_fields := array_append(sensitive_fields, 'phone'); END IF;
  IF array_length(sensitive_fields, 1) > 0 THEN 
    PERFORM log_sensitive_access('profiles', 'UPDATE', sensitive_fields, jsonb_build_object('user_id', NEW.id, 'modified_at', now()));
  END IF; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN RAISE EXCEPTION 'Invalid email format'; END IF;
  NEW.first_name := regexp_replace(COALESCE(NEW.first_name, ''), '[<>]', '', 'g');
  NEW.last_name := regexp_replace(COALESCE(NEW.last_name, ''), '[<>]', '', 'g');
  RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.monitor_transaction_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE user_transaction_count INTEGER; risk_score INTEGER := 0; alert_reasons TEXT[] := '{}'; BEGIN
  IF NEW.type IN ('buy', 'sell') AND (NEW.quantity * COALESCE(NEW.unit_price_usd, 0)) > 10000 THEN
    risk_score := 30; alert_reasons := array_append(alert_reasons, 'High-value transaction'); END IF;
  IF risk_score >= 30 THEN 
    INSERT INTO security_alerts (user_id, alert_type, severity, title, description, metadata)
    VALUES (NEW.user_id, 'suspicious_transaction', 'high', 'Suspicious Transaction', array_to_string(alert_reasons, ', '),
      jsonb_build_object('transaction_id', NEW.id, 'risk_score', risk_score));
  END IF; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.audit_admin_access()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN IF is_admin(auth.uid()) THEN 
  PERFORM log_high_risk_operation('ADMIN_ACCESS', TG_TABLE_NAME, ARRAY['admin_privileged_operation'], 5);
END IF; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.simple_profile_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN IF (NEW.ssn_last_four IS DISTINCT FROM OLD.ssn_last_four) THEN
  INSERT INTO audit_log (user_id, table_name, operation, timestamp, metadata)
  VALUES (auth.uid(), 'profiles', 'SENSITIVE_UPDATE', now(), '{}');
END IF; RETURN NEW; END; $$;

-- Enhanced email masking
CREATE OR REPLACE FUNCTION mask_email(email_value text)
RETURNS text LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT CASE WHEN email_value IS NULL THEN NULL
  WHEN email_value LIKE '%@%' THEN substring(email_value from 1 for 2) || '***@' || split_part(email_value, '@', 2)
  ELSE '***@***.com' END; $$;

-- Emergency lockdown
CREATE OR REPLACE FUNCTION emergency_pii_lockdown_active()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE lockdown_status boolean := false; BEGIN
  SELECT (config_value->>'enabled')::boolean INTO lockdown_status
  FROM security_config WHERE config_key = 'emergency_pii_lockdown';
  RETURN COALESCE(lockdown_status, false); END; $$;

-- Security config
INSERT INTO security_config (config_key, config_value, created_by)
VALUES ('emergency_pii_lockdown', '{"enabled": false}'::jsonb, NULL)
ON CONFLICT (config_key) DO NOTHING;