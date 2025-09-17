-- Comprehensive security enhancement for customer personal information protection
-- Fixed version without pgcrypto dependency issues

-- 1. Create data masking functions for sensitive fields
CREATE OR REPLACE FUNCTION mask_ssn(ssn_value text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN ssn_value IS NULL THEN NULL
    WHEN length(ssn_value) >= 4 THEN '***-**-' || right(ssn_value, 4)
    ELSE '***-**-****'
  END;
$$;

CREATE OR REPLACE FUNCTION mask_phone(phone_value text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN phone_value IS NULL THEN NULL
    WHEN length(phone_value) >= 4 THEN '***-***-' || right(regexp_replace(phone_value, '[^0-9]', '', 'g'), 4)
    ELSE '***-***-****'
  END;
$$;

CREATE OR REPLACE FUNCTION mask_address(address_value text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN address_value IS NULL THEN NULL
    ELSE split_part(address_value, ' ', 1) || ' *** [PROTECTED]'
  END;
$$;

-- 2. Create enhanced access control function
CREATE OR REPLACE FUNCTION can_access_sensitive_pii(user_uuid uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_kyc_status text;
  is_same_user boolean;
BEGIN
  -- Check if accessing own data
  is_same_user := (user_uuid = target_user_id);
  
  -- Only allow access to own data
  IF NOT is_same_user THEN
    RETURN false;
  END IF;
  
  -- Get KYC status
  SELECT kyc_status INTO user_kyc_status 
  FROM profiles 
  WHERE id = user_uuid;
  
  -- Allow full access only if KYC is verified
  RETURN (user_kyc_status = 'verified');
END;
$$;

-- 3. Create secure profile view with conditional data masking
CREATE OR REPLACE VIEW secure_profiles AS
SELECT 
  id,
  email,
  first_name,
  last_name,
  country,
  kyc_status,
  created_at,
  updated_at,
  
  -- Sensitive data with conditional access
  CASE 
    WHEN can_access_sensitive_pii(auth.uid(), id) THEN phone
    ELSE mask_phone(phone)
  END as phone,
  
  CASE 
    WHEN can_access_sensitive_pii(auth.uid(), id) THEN ssn_last_four
    ELSE mask_ssn(ssn_last_four)
  END as ssn_last_four,
  
  CASE 
    WHEN can_access_sensitive_pii(auth.uid(), id) THEN address
    ELSE mask_address(address)
  END as address,
  
  CASE 
    WHEN can_access_sensitive_pii(auth.uid(), id) THEN city
    ELSE '*** [PROTECTED]'
  END as city,
  
  CASE 
    WHEN can_access_sensitive_pii(auth.uid(), id) THEN state
    ELSE '**'
  END as state,
  
  CASE 
    WHEN can_access_sensitive_pii(auth.uid(), id) THEN zip_code
    ELSE '*****'
  END as zip_code,
  
  CASE 
    WHEN can_access_sensitive_pii(auth.uid(), id) THEN date_of_birth
    ELSE NULL
  END as date_of_birth

FROM profiles;

-- Grant access to the secure view
GRANT SELECT ON secure_profiles TO authenticated;

-- 4. Enhanced audit logging for sensitive data access
CREATE OR REPLACE FUNCTION log_pii_access(
  p_user_id uuid,
  p_target_user_id uuid,
  p_operation text,
  p_fields_accessed text[],
  p_access_granted boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
      'access_granted', p_access_granted,
      'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent'
    )
  );
END;
$$;

-- 5. Create rate limiting table for PII access
CREATE TABLE IF NOT EXISTS pii_access_rate_limit (
  user_id uuid NOT NULL,
  access_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  PRIMARY KEY (user_id)
);

ALTER TABLE pii_access_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own rate limits" ON pii_access_rate_limit
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Rate limiting function (50 PII accesses per hour)
CREATE OR REPLACE FUNCTION check_pii_rate_limit(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- Check if under limit (50 per hour)
  IF current_count < 50 THEN
    UPDATE pii_access_rate_limit 
    SET access_count = access_count + 1 
    WHERE user_id = user_uuid;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- 7. Enhanced profiles policies with rate limiting
DROP POLICY IF EXISTS "Users can view own profile with PII protection" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile with validation" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- New restrictive policies
CREATE POLICY "Users can view own profile with rate limiting" ON profiles
FOR SELECT 
TO authenticated
USING (
  auth.uid() = id 
  AND check_pii_rate_limit(auth.uid())
);

CREATE POLICY "Users can update own profile securely" ON profiles
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- 8. Trigger for PII access logging
CREATE OR REPLACE FUNCTION profiles_pii_access_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sensitive_fields text[] := '{}';
  access_granted boolean;
BEGIN
  -- Identify sensitive fields being accessed
  IF NEW.ssn_last_four IS NOT NULL OR OLD.ssn_last_four IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'ssn_last_four');
  END IF;
  
  IF NEW.date_of_birth IS NOT NULL OR OLD.date_of_birth IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'date_of_birth');
  END IF;
  
  IF NEW.address IS NOT NULL OR OLD.address IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'address');
  END IF;
  
  IF NEW.phone IS NOT NULL OR OLD.phone IS NOT NULL THEN
    sensitive_fields := array_append(sensitive_fields, 'phone');
  END IF;
  
  -- Log if sensitive fields are involved
  IF array_length(sensitive_fields, 1) > 0 THEN
    access_granted := can_access_sensitive_pii(auth.uid(), COALESCE(NEW.id, OLD.id));
    
    PERFORM log_pii_access(
      auth.uid(),
      COALESCE(NEW.id, OLD.id),
      TG_OP,
      sensitive_fields,
      access_granted
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply the trigger
CREATE TRIGGER profiles_pii_access_audit
  AFTER SELECT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION profiles_pii_access_trigger();

-- 9. Constraint to ensure sensitive data requires KYC
ALTER TABLE profiles 
ADD CONSTRAINT check_kyc_required_for_sensitive_data 
CHECK (
  (ssn_last_four IS NULL AND date_of_birth IS NULL) 
  OR 
  (kyc_status IN ('verified', 'pending'))
);

-- 10. Suspicious access monitoring
CREATE OR REPLACE FUNCTION notify_suspicious_pii_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_access_count integer;
BEGIN
  -- Count recent PII accesses by this user in last 10 minutes
  SELECT COUNT(*) INTO recent_access_count
  FROM audit_log
  WHERE user_id = NEW.user_id
    AND table_name = 'profiles'
    AND array_length(sensitive_fields, 1) > 0
    AND timestamp > (now() - interval '10 minutes');
  
  -- If more than 15 PII accesses in 10 minutes, create alert
  IF recent_access_count > 15 THEN
    INSERT INTO notifications (user_id, title, body, kind)
    VALUES (
      NEW.user_id,
      'Security Alert: High PII Access Volume',
      'Unusual pattern of personal information access detected. If this was not you, please secure your account immediately.',
      'security_alert'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply suspicious access monitoring
CREATE TRIGGER detect_suspicious_pii_access
  AFTER INSERT ON audit_log
  FOR EACH ROW
  WHEN (NEW.table_name = 'profiles' AND array_length(NEW.sensitive_fields, 1) > 0)
  EXECUTE FUNCTION notify_suspicious_pii_access();