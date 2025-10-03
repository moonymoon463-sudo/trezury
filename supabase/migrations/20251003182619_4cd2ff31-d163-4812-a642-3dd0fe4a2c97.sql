-- Fix v_profiles_masked to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures the view respects RLS policies of the querying user

DROP VIEW IF EXISTS public.v_profiles_masked;

CREATE VIEW public.v_profiles_masked
WITH (security_invoker=on)
AS
SELECT 
  p.id,
  p.email,
  p.first_name,
  p.last_name,
  p.kyc_status,
  p.country,
  p.created_at,
  p.updated_at,
  -- Conditionally mask sensitive fields based on whether user is viewing their own profile
  CASE 
    WHEN auth.uid() = p.id THEN p.phone
    ELSE mask_phone(p.phone)
  END as phone,
  CASE 
    WHEN auth.uid() = p.id THEN p.address
    ELSE mask_address(p.address)
  END as address,
  CASE 
    WHEN auth.uid() = p.id THEN p.city
    ELSE NULL
  END as city,
  CASE 
    WHEN auth.uid() = p.id THEN p.state
    ELSE NULL
  END as state,
  CASE 
    WHEN auth.uid() = p.id THEN p.zip_code
    ELSE NULL
  END as zip_code,
  -- Never expose SSN or DOB, even to self (use secure functions if needed)
  NULL as ssn_last_four,
  NULL as date_of_birth
FROM public.profiles p;

-- Ensure permissions are still granted
GRANT SELECT ON public.v_profiles_masked TO authenticated;