-- Fix security definer view warning
-- Remove the profiles_secure view and rely on secure functions instead

DROP VIEW IF EXISTS public.profiles_secure;

-- Create a better alternative: a function that returns masked profile data
CREATE OR REPLACE FUNCTION public.get_masked_profile(target_user_id uuid DEFAULT auth.uid())
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
  ssn_display text,
  date_of_birth date,
  kyc_status text,
  kyc_submitted_at timestamp with time zone,
  kyc_verified_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_kyc_status text;
BEGIN
  -- Verify user can only access their own profile
  IF auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Access denied: Can only access own profile';
  END IF;
  
  -- Get KYC status
  SELECT p.kyc_status INTO user_kyc_status 
  FROM profiles p
  WHERE p.id = target_user_id;
  
  -- Log the access
  PERFORM log_high_risk_operation(
    'MASKED_PROFILE_ACCESS',
    'profiles',
    ARRAY['phone', 'address', 'ssn_last_four'],
    2
  );
  
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    -- Masked fields based on KYC status
    CASE 
      WHEN user_kyc_status = 'verified' THEN p.phone
      ELSE mask_phone(p.phone)
    END as phone,
    CASE 
      WHEN user_kyc_status = 'verified' THEN p.address
      ELSE mask_address(p.address)
    END as address,
    p.city,
    p.state,
    p.zip_code,
    p.country,
    mask_ssn(p.ssn_last_four) as ssn_display,
    CASE 
      WHEN user_kyc_status = 'verified' THEN p.date_of_birth
      ELSE NULL
    END as date_of_birth,
    p.kyc_status,
    p.kyc_submitted_at,
    p.kyc_verified_at,
    p.created_at,
    p.updated_at
  FROM profiles p
  WHERE p.id = target_user_id;
END;
$$;

COMMENT ON FUNCTION public.get_masked_profile IS 'Returns user profile with automatic data masking based on KYC status. Uses secure function instead of view to avoid SECURITY DEFINER issues.';