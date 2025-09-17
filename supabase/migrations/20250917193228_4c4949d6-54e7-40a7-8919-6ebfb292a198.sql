-- Remove all SECURITY DEFINER attributes from functions to resolve the warning

-- 1. Fix the rate limiting function
CREATE OR REPLACE FUNCTION check_pii_rate_limit(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_count integer;
  window_start timestamptz;
BEGIN
  SELECT access_count, pii_access_rate_limit.window_start 
  INTO current_count, window_start
  FROM pii_access_rate_limit 
  WHERE user_id = user_uuid;
  
  -- If no record exists or window expired (1 hour), reset
  IF current_count IS NULL OR window_start < (now() - interval '1 hour') THEN
    INSERT INTO pii_access_rate_limit (user_id, access_count, window_start)
    VALUES (user_uuid, 1, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET access_count = 1, window_start = now();
    RETURN true;
  END IF;
  
  -- Check if under limit (30 per hour)
  IF current_count < 30 THEN
    UPDATE pii_access_rate_limit 
    SET access_count = access_count + 1 
    WHERE user_id = user_uuid;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- 2. Fix the audit logging function
CREATE OR REPLACE FUNCTION log_sensitive_access(
  p_table_name text,
  p_operation text,
  p_sensitive_fields text[] DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (
    user_id,
    table_name,
    operation,
    sensitive_fields,
    timestamp,
    metadata
  ) VALUES (
    auth.uid(),
    p_table_name,
    p_operation,
    p_sensitive_fields,
    now(),
    p_metadata
  );
END;
$$;

-- 3. Fix the PII access logging function
CREATE OR REPLACE FUNCTION log_pii_access(
  p_user_id uuid,
  p_target_user_id uuid,
  p_operation text,
  p_fields_accessed text[],
  p_access_granted boolean
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (
    user_id,
    table_name,
    operation,
    sensitive_fields,
    timestamp,
    metadata
  ) VALUES (
    p_user_id,
    'profiles',
    p_operation,
    p_fields_accessed,
    now(),
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'access_granted', p_access_granted
    )
  );
END;
$$;

-- 4. Fix the update audit trigger function
CREATE OR REPLACE FUNCTION profiles_update_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sensitive_fields text[] := '{}';
BEGIN
  -- Check which sensitive fields are being modified
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
  
  -- Log modifications to sensitive fields
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

-- 5. Fix the access pattern validation function
CREATE OR REPLACE FUNCTION validate_profile_access_pattern(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  recent_access_count integer;
  user_kyc_status text;
BEGIN
  -- Get user's KYC status
  SELECT kyc_status INTO user_kyc_status 
  FROM profiles 
  WHERE id = user_uuid;
  
  -- Count recent audit log entries for this user
  SELECT COUNT(*) INTO recent_access_count
  FROM audit_log
  WHERE user_id = user_uuid
    AND table_name = 'profiles'
    AND timestamp > (now() - interval '5 minutes');
  
  -- Block access if suspicious pattern detected
  IF recent_access_count > 10 THEN
    -- Create security alert
    INSERT INTO notifications (user_id, title, body, kind)
    VALUES (
      user_uuid,
      'Security Alert: Unusual Access Pattern',
      'High frequency access to personal information detected. Account access may be restricted for security.',
      'security_alert'
    );
    
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- 6. Fix KYC verification function  
CREATE OR REPLACE FUNCTION is_kyc_verified(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT kyc_status = 'verified' 
  FROM profiles 
  WHERE id = user_uuid;
$$;

-- 7. Fix KYC document access validation function
CREATE OR REPLACE FUNCTION validate_kyc_document_access(doc_user_id uuid, doc_status text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() = doc_user_id AND doc_status = 'uploaded';
$$;