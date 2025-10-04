-- Fix security definer view issue
-- Drop the existing view and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS v_profiles_masked CASCADE;

-- Create masked profile view with SECURITY INVOKER to respect RLS
CREATE VIEW v_profiles_masked
WITH (security_invoker=on)
AS
SELECT 
  id,
  email,
  first_name,
  last_name,
  kyc_status,
  country,
  created_at,
  updated_at,
  -- Mask sensitive fields
  CASE 
    WHEN ssn_last_four IS NOT NULL 
    THEN '***-**-' || ssn_last_four
    ELSE NULL
  END AS masked_ssn,
  CASE 
    WHEN date_of_birth IS NOT NULL 
    THEN EXTRACT(YEAR FROM date_of_birth)::text || '-01-01'
    ELSE NULL
  END AS birth_year,
  CASE 
    WHEN phone IS NOT NULL 
    THEN '***-***-' || RIGHT(phone, 4)
    ELSE NULL
  END AS masked_phone,
  CASE 
    WHEN address IS NOT NULL 
    THEN SPLIT_PART(address, ' ', 1) || ' *** [PROTECTED]'
    ELSE NULL
  END AS masked_address
FROM profiles;

-- Grant access to authenticated users (RLS on profiles will be enforced)
GRANT SELECT ON v_profiles_masked TO authenticated;

-- Add helpful comment
COMMENT ON VIEW v_profiles_masked IS 'Masked view of profiles - respects RLS policies of querying user';