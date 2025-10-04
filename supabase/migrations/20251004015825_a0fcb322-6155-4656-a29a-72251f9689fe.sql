-- Phase 4A: Revoke Direct Table Access & Create Secure Update Function

-- Remove direct access to profiles table for authenticated users
REVOKE ALL ON public.profiles FROM authenticated;

-- Grant access only to masked view
GRANT SELECT ON public.v_profiles_masked TO authenticated;

-- Create secure function for users to update their own PII
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip_code text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_ssn_last_four text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  -- Verify user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Rate limit check
  IF NOT check_pii_rate_limit(v_user_id) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
  END IF;

  -- Update profile with encryption
  UPDATE profiles SET
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    phone = COALESCE(p_phone, phone),
    address = COALESCE(p_address, address),
    city = COALESCE(p_city, city),
    state = COALESCE(p_state, state),
    zip_code = COALESCE(p_zip_code, zip_code),
    country = COALESCE(p_country, country),
    ssn_last_four = COALESCE(p_ssn_last_four, ssn_last_four),
    ssn_encrypted = CASE 
      WHEN p_ssn_last_four IS NOT NULL THEN encrypt_pii(p_ssn_last_four)
      ELSE ssn_encrypted 
    END,
    date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
    dob_encrypted = CASE 
      WHEN p_date_of_birth IS NOT NULL THEN encrypt_pii(p_date_of_birth::text)
      ELSE dob_encrypted
    END,
    updated_at = now()
  WHERE id = v_user_id
  RETURNING jsonb_build_object(
    'success', true,
    'updated_at', updated_at
  ) INTO v_result;

  -- Log the update
  PERFORM log_high_risk_operation(
    'PII_UPDATE',
    'profiles',
    ARRAY['ssn_last_four', 'date_of_birth', 'phone', 'address'],
    4
  );

  RETURN COALESCE(v_result, jsonb_build_object('error', 'Update failed'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_profile TO authenticated;

-- Phase 4B: Migrate Existing PII to Encrypted Format

-- Encrypt existing SSN data
UPDATE profiles
SET ssn_encrypted = encrypt_pii(ssn_last_four)
WHERE ssn_last_four IS NOT NULL 
  AND ssn_encrypted IS NULL;

-- Encrypt existing DOB data  
UPDATE profiles
SET dob_encrypted = encrypt_pii(date_of_birth::text)
WHERE date_of_birth IS NOT NULL 
  AND dob_encrypted IS NULL;

-- Log migration for audit trail
INSERT INTO audit_log (user_id, table_name, operation, sensitive_fields, metadata)
SELECT 
  id,
  'profiles',
  'PII_ENCRYPTION_MIGRATION',
  ARRAY['ssn_encrypted', 'dob_encrypted'],
  jsonb_build_object(
    'migrated_at', now(),
    'automated', true,
    'phase', '4B'
  )
FROM profiles
WHERE (ssn_encrypted IS NOT NULL OR dob_encrypted IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM audit_log 
    WHERE user_id = profiles.id 
    AND operation = 'PII_ENCRYPTION_MIGRATION'
  );