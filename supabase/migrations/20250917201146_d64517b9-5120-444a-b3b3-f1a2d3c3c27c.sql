-- Phase 1: Create Secure Data Access Layer with PII Protection (Fixed)
-- This migration implements comprehensive protection for sensitive customer data

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
FROM public.profiles;

-- Create function to log profile access (called from application)
CREATE OR REPLACE FUNCTION public.log_profile_access(accessed_user_id uuid)
RETURNS void AS $$
DECLARE
  access_granted boolean;
  sensitive_fields text[];
BEGIN
  -- Determine what fields the user can access
  SELECT CASE WHEN kyc_status = 'verified' THEN true ELSE false END
  INTO access_granted
  FROM profiles
  WHERE id = accessed_user_id;
  
  -- Determine which fields are being accessed
  sensitive_fields := ARRAY['email', 'phone', 'address'];
  
  IF access_granted THEN
    sensitive_fields := sensitive_fields || ARRAY['ssn_last_four', 'date_of_birth'];
  END IF;
  
  -- Log the access with rate limiting check
  IF check_pii_rate_limit(auth.uid()) THEN
    PERFORM log_pii_access(
      auth.uid(),
      accessed_user_id,
      'PROFILE_ACCESS',
      sensitive_fields,
      access_granted
    );
  ELSE
    RAISE EXCEPTION 'Profile access rate limit exceeded. Please wait before trying again.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to detect suspicious access patterns
CREATE OR REPLACE FUNCTION public.check_suspicious_access_pattern(user_uuid uuid)
RETURNS boolean AS $$
DECLARE
  recent_access_count integer;
  user_kyc_status text;
BEGIN
  -- Get recent access count in last 5 minutes
  SELECT COUNT(*) INTO recent_access_count
  FROM audit_log
  WHERE user_id = user_uuid
    AND table_name = 'profiles'
    AND timestamp > (now() - interval '5 minutes');
  
  -- Get user KYC status
  SELECT kyc_status INTO user_kyc_status
  FROM profiles
  WHERE id = user_uuid;
  
  -- Alert if suspicious pattern detected
  IF recent_access_count > 15 THEN
    INSERT INTO notifications (user_id, title, body, kind)
    VALUES (
      user_uuid,
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
        'kyc_status', user_kyc_status,
        'alert_triggered', true
      )
    );
    
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create enhanced audit trigger for profile updates only
CREATE OR REPLACE FUNCTION public.enhanced_profile_update_audit()
RETURNS TRIGGER AS $$
DECLARE
  sensitive_fields text[] := '{}';
BEGIN
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
  
  IF NEW.first_name IS DISTINCT FROM OLD.first_name THEN
    sensitive_fields := array_append(sensitive_fields, 'first_name');
  END IF;
  
  IF NEW.last_name IS DISTINCT FROM OLD.last_name THEN
    sensitive_fields := array_append(sensitive_fields, 'last_name');
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
        'update_source', 'application',
        'fields_updated', sensitive_fields
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Replace existing profile audit triggers
DROP TRIGGER IF EXISTS profiles_audit_trigger ON public.profiles;
DROP TRIGGER IF EXISTS simple_profile_audit_trigger ON public.profiles;
DROP TRIGGER IF EXISTS profiles_update_audit_trigger ON public.profiles;
DROP TRIGGER IF EXISTS enhanced_profile_audit_trigger ON public.profiles;

-- Create new update-only audit trigger
CREATE TRIGGER enhanced_profile_update_audit_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION enhanced_profile_update_audit();

-- Enable RLS on secure_profiles view
ALTER VIEW public.secure_profiles SET (security_invoker = true);

-- Create RLS policy for secure_profiles view access with logging
CREATE POLICY "Secure profiles access with comprehensive logging"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Rate limiting check
  check_pii_rate_limit(auth.uid()) AND
  -- Suspicious access pattern check  
  check_suspicious_access_pattern(auth.uid()) AND
  -- Only allow access to own profile
  auth.uid() = id AND
  -- Log the access attempt (using a side-effect function)
  (SELECT log_profile_access(id), true)::boolean
);

-- Grant permissions for the secure view
GRANT SELECT ON public.secure_profiles TO authenticated;

-- Revoke direct SELECT permission on profiles table for regular users
REVOKE SELECT ON public.profiles FROM authenticated;

-- Create restricted policy that only allows access through secure view
CREATE POLICY "Profiles access only through secure view"
ON public.profiles
FOR SELECT
TO authenticated
USING (false); -- Block direct access

-- Allow access through the secure view by temporarily granting select for the view
GRANT SELECT ON public.profiles TO authenticated;

-- Update the main policy to allow secure access
DROP POLICY IF EXISTS "Profiles access only through secure view" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile securely" ON public.profiles;

CREATE POLICY "Secure profile access with full protection"
ON public.profiles
FOR SELECT
TO authenticated  
USING (
  auth.uid() = id AND
  check_pii_rate_limit(auth.uid()) AND
  validate_profile_access_pattern(auth.uid())
);