-- Drop the insecure secure_profiles view
DROP VIEW IF EXISTS public.secure_profiles;

-- Create secure function to access profile data with proper access control
CREATE OR REPLACE FUNCTION public.get_secure_profile(target_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  country text,
  ssn_last_four text,
  date_of_birth date,
  kyc_status text,
  kyc_submitted_at timestamptz,
  kyc_verified_at timestamptz,
  kyc_rejection_reason text,
  created_at timestamptz,
  updated_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requesting_user_id uuid := auth.uid();
  user_to_fetch uuid := COALESCE(target_user_id, requesting_user_id);
  profile_record RECORD;
  user_kyc_status text;
BEGIN
  -- Security check: users can only access their own data
  IF requesting_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF requesting_user_id != user_to_fetch THEN
    RAISE EXCEPTION 'Access denied: can only access own profile data';
  END IF;
  
  -- Rate limiting check
  IF NOT check_pii_rate_limit(requesting_user_id) THEN
    RAISE EXCEPTION 'Rate limit exceeded for PII access';
  END IF;
  
  -- Validate access pattern
  IF NOT validate_profile_access_pattern(requesting_user_id) THEN
    RAISE EXCEPTION 'Suspicious access pattern detected';
  END IF;
  
  -- Get the profile data
  SELECT * INTO profile_record 
  FROM profiles 
  WHERE profiles.id = user_to_fetch;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  
  user_kyc_status := profile_record.kyc_status;
  
  -- Log PII access for audit
  PERFORM log_profile_access(
    user_to_fetch, 
    ARRAY['email', 'phone', 'address', 'ssn_last_four', 'date_of_birth']
  );
  
  -- Return masked or full data based on KYC status
  RETURN QUERY SELECT
    profile_record.id,
    profile_record.email,
    profile_record.first_name,
    profile_record.last_name,
    CASE 
      WHEN user_kyc_status = 'verified' THEN profile_record.phone
      ELSE mask_phone(profile_record.phone)
    END,
    CASE 
      WHEN user_kyc_status = 'verified' THEN profile_record.address
      ELSE mask_address(profile_record.address)
    END,
    profile_record.city,
    profile_record.state,
    profile_record.zip_code,
    profile_record.country,
    CASE 
      WHEN user_kyc_status = 'verified' THEN profile_record.ssn_last_four
      ELSE mask_ssn(profile_record.ssn_last_four)
    END,
    CASE 
      WHEN user_kyc_status = 'verified' THEN profile_record.date_of_birth
      ELSE NULL
    END,
    profile_record.kyc_status,
    profile_record.kyc_submitted_at,
    profile_record.kyc_verified_at,
    profile_record.kyc_rejection_reason,
    profile_record.created_at,
    profile_record.updated_at;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_secure_profile(uuid) TO authenticated;