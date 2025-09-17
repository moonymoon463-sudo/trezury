-- Comprehensive security enhancement for customer personal information protection
-- Corrected version with proper trigger syntax

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

-- 4. Create rate limiting table for PII access
CREATE TABLE IF NOT EXISTS pii_access_rate_limit (
  user_id uuid NOT NULL,
  access_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  PRIMARY KEY (user_id)
);

ALTER TABLE pii_access_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only manage their own rate limits" ON pii_access_rate_limit
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Rate limiting function (30 PII accesses per hour)
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
  
  -- Check if under limit (30 per hour for better security)
  IF current_count < 30 THEN
    UPDATE pii_access_rate_limit 
    SET access_count = access_count + 1 
    WHERE user_id = user_uuid;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- 6. Enhanced profiles policies with rate limiting and PII protection
DROP POLICY IF EXISTS "Users can view own profile with rate limiting" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile securely" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- New security-hardened policies
CREATE POLICY "Users can view own profile with enhanced security" ON profiles
FOR SELECT 
TO authenticated
USING (
  auth.uid() = id 
  AND check_pii_rate_limit(auth.uid())
);

CREATE POLICY "Users can update own profile with logging" ON profiles
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- 7. Trigger for UPDATE operations to log sensitive data modifications
CREATE OR REPLACE FUNCTION profiles_update_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Apply the UPDATE trigger (safe operation)
CREATE TRIGGER profiles_sensitive_update_audit
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION profiles_update_audit_trigger();

-- 8. Data validation constraint for sensitive information
ALTER TABLE profiles 
ADD CONSTRAINT check_kyc_required_for_pii 
CHECK (
  (ssn_last_four IS NULL AND date_of_birth IS NULL) 
  OR 
  (kyc_status IN ('verified', 'pending', 'rejected'))
);

-- 9. Create function to validate profile access patterns
CREATE OR REPLACE FUNCTION validate_profile_access_pattern(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 10. Enhanced audit function that's already been created but ensure it exists
CREATE OR REPLACE FUNCTION log_sensitive_access(
  p_table_name text,
  p_operation text,
  p_sensitive_fields text[] DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
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
    auth.uid(),
    p_table_name,
    p_operation,
    p_sensitive_fields,
    now(),
    p_metadata
  );
END;
$$;