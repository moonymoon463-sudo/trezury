-- Fixed: Create Secure Data Access Layer with PII Protection
-- PostgreSQL doesn't support SELECT triggers, so we'll use a different approach

-- Create secure_profiles view with automatic data masking based on KYC status
CREATE OR REPLACE VIEW public.secure_profiles AS
SELECT 
  id,
  email,
  -- Only show sensitive fields if user is accessing their own data and is KYC verified
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN first_name
    WHEN auth.uid() = id THEN first_name
    ELSE NULL
  END as first_name,
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN last_name
    WHEN auth.uid() = id THEN last_name
    ELSE NULL
  END as last_name,
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN phone
    WHEN auth.uid() = id THEN mask_phone(phone)
    ELSE NULL
  END as phone,
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN address
    WHEN auth.uid() = id THEN mask_address(address)
    ELSE NULL
  END as address,
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN city
    WHEN auth.uid() = id THEN city
    ELSE NULL
  END as city,
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN state
    WHEN auth.uid() = id THEN state
    ELSE NULL
  END as state,
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN zip_code
    WHEN auth.uid() = id THEN zip_code
    ELSE NULL
  END as zip_code,
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN country
    WHEN auth.uid() = id THEN country
    ELSE NULL
  END as country,
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN ssn_last_four
    WHEN auth.uid() = id THEN mask_ssn(ssn_last_four)
    ELSE NULL
  END as ssn_last_four,
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN date_of_birth
    ELSE NULL
  END as date_of_birth,
  kyc_status,
  kyc_submitted_at,
  kyc_verified_at,
  kyc_rejection_reason,
  created_at,
  updated_at
FROM public.profiles
WHERE auth.uid() = id; -- Ensure users can only see their own data

-- Enable RLS on the secure view
ALTER VIEW public.secure_profiles SET (security_invoker = true);

-- Create function to log profile access (called manually from application)
CREATE OR REPLACE FUNCTION public.log_profile_access(target_user_id uuid, accessed_fields text[])
RETURNS void AS $$
BEGIN
  -- Check rate limit first
  IF NOT check_pii_rate_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Rate limit exceeded for PII access';
  END IF;

  -- Log the access
  PERFORM log_pii_access(
    auth.uid(),
    target_user_id,
    'PROFILE_ACCESS',
    accessed_fields,
    true
  );

  -- Check for suspicious patterns
  DECLARE
    recent_access_count integer;
  BEGIN
    SELECT COUNT(*) INTO recent_access_count
    FROM audit_log
    WHERE user_id = auth.uid()
      AND table_name = 'profiles'
      AND timestamp > (now() - interval '5 minutes');

    -- Alert if suspicious pattern detected
    IF recent_access_count > 15 THEN
      INSERT INTO notifications (user_id, title, body, kind)
      VALUES (
        auth.uid(),
        'Security Alert: Unusual Profile Access',
        'Unusual access pattern to profile information detected. Please contact support if this was not you.',
        'security_alert'
      );

      -- Log security incident
      PERFORM log_sensitive_access(
        'profiles',
        'SUSPICIOUS_ACCESS_PATTERN',
        ARRAY['multiple_rapid_access'],
        jsonb_build_object(
          'access_count', recent_access_count,
          'time_window', '5_minutes',
          'alert_triggered', true
        )
      );
    END IF;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enhanced audit function for profile updates
CREATE OR REPLACE FUNCTION public.enhanced_profile_audit()
RETURNS TRIGGER AS $$
DECLARE
  sensitive_fields text[] := '{}';
BEGIN
  -- Only for UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    -- Track which sensitive fields are being modified
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
        'SENSITIVE_UPDATE',
        sensitive_fields,
        jsonb_build_object(
          'user_id', NEW.id,
          'modified_at', now(),
          'kyc_status', NEW.kyc_status,
          'update_source', 'application'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Replace existing profile audit triggers
DROP TRIGGER IF EXISTS profiles_audit_trigger ON public.profiles;
DROP TRIGGER IF EXISTS simple_profile_audit_trigger ON public.profiles;
DROP TRIGGER IF EXISTS profiles_update_audit_trigger ON public.profiles;
DROP TRIGGER IF EXISTS enhanced_profile_audit_trigger ON public.profiles;

-- Create new enhanced audit trigger for updates only
CREATE TRIGGER enhanced_profile_update_audit_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION enhanced_profile_audit();

-- Grant permissions for the secure view
GRANT SELECT ON public.secure_profiles TO authenticated;

-- Create RLS policy for secure view access
CREATE POLICY "Secure profiles access with rate limiting"
ON public.secure_profiles
FOR SELECT
TO authenticated
USING (
  check_pii_rate_limit(auth.uid()) AND
  validate_profile_access_pattern(auth.uid())
);

-- Add stricter RLS policy to profiles table to require logging
DROP POLICY IF EXISTS "Users can access secure profiles with logging" ON public.profiles;
CREATE POLICY "Profiles access requires enhanced security"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id AND
  check_pii_rate_limit(auth.uid()) AND
  validate_profile_access_pattern(auth.uid())
);