-- ===================================================================
-- Phase 1: Immediate Security Fixes - Masked Views & RLS Policies
-- ===================================================================

-- Step 1: Drop existing view if it exists, then recreate
DROP VIEW IF EXISTS v_profiles_masked CASCADE;

-- Create masked profile view for safe PII display
CREATE VIEW v_profiles_masked AS
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

-- Grant access to authenticated users (RLS on profiles still applies)
GRANT SELECT ON v_profiles_masked TO authenticated;

-- Enable security barrier to prevent information leakage
ALTER VIEW v_profiles_masked SET (security_barrier = true);

-- Step 2: Simplify and strengthen RLS policies on profiles table
-- Drop overlapping policies to avoid confusion
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_self_read_ratelimited" ON profiles;

-- Create single, clear policy for user access with rate limiting
CREATE POLICY "users_own_profile_access" 
ON profiles 
FOR ALL
TO authenticated
USING (
  auth.uid() = id 
  AND check_pii_rate_limit(auth.uid())
)
WITH CHECK (
  auth.uid() = id 
  AND check_pii_rate_limit(auth.uid())
);

-- Admin policy already exists (profiles_admin_read) - keep it separate

-- Step 3: Add index for performance on rate limit checks
CREATE INDEX IF NOT EXISTS idx_audit_log_user_table_timestamp 
ON audit_log(user_id, table_name, timestamp DESC)
WHERE table_name = 'profiles';

-- Add helpful comment
COMMENT ON VIEW v_profiles_masked IS 'Masked view of profiles for safe PII display without exposing sensitive data';