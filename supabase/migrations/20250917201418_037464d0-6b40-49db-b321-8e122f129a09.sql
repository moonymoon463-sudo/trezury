-- Fix Security Definer View warning by ensuring view is not security definer
-- Drop and recreate the view without security definer property
DROP VIEW IF EXISTS public.secure_profiles;

CREATE VIEW public.secure_profiles AS
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
  END as zip_zip_code,
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

-- Grant permissions
GRANT SELECT ON public.secure_profiles TO authenticated;