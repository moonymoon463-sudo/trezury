-- ============================================
-- CRITICAL SECURITY ENHANCEMENT FOR PROFILES TABLE
-- Implements field-level encryption, data masking, and secure access
-- ============================================

-- 1. Create encryption key storage (using pgcrypto extension)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add encrypted columns for most sensitive data
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS ssn_encrypted bytea,
  ADD COLUMN IF NOT EXISTS dob_encrypted bytea;

-- 3. Drop existing functions that will be replaced
DROP FUNCTION IF EXISTS public.get_secure_profile(uuid);
DROP FUNCTION IF EXISTS public.get_encrypted_profile_field(text, uuid);
DROP FUNCTION IF EXISTS public.get_verified_pii_field(text, uuid);
DROP FUNCTION IF EXISTS public.encrypt_pii(text, text);
DROP FUNCTION IF EXISTS public.decrypt_pii(bytea, text, uuid);
DROP FUNCTION IF EXISTS public.enforce_pii_encryption();

-- 4. Create secure function to encrypt sensitive data
CREATE OR REPLACE FUNCTION public.encrypt_pii(plaintext text, field_name text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Use a combination of user_id and field name for encryption key derivation
  -- In production, this should use a proper key management system
  encryption_key := encode(digest(auth.uid()::text || field_name || current_setting('app.encryption_secret', true), 'sha256'), 'hex');
  
  RETURN pgp_sym_encrypt(plaintext, encryption_key);
END;
$$;

-- 5. Create secure function to decrypt sensitive data with validation
CREATE OR REPLACE FUNCTION public.decrypt_pii(encrypted_data bytea, field_name text, target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
  decrypted_value text;
  user_kyc_status text;
BEGIN
  -- Security checks
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required for PII access';
  END IF;
  
  -- Only allow users to decrypt their own data
  IF auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Access denied: Cannot access other users PII';
  END IF;
  
  -- Check KYC status
  SELECT kyc_status INTO user_kyc_status 
  FROM profiles 
  WHERE id = target_user_id;
  
  -- Rate limiting check
  IF NOT check_pii_rate_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Rate limit exceeded for PII access';
  END IF;
  
  -- Log the access
  PERFORM log_high_risk_operation(
    'PII_DECRYPT',
    'profiles',
    ARRAY[field_name],
    5  -- Critical risk level
  );
  
  -- Decrypt data
  encryption_key := encode(digest(target_user_id::text || field_name || current_setting('app.encryption_secret', true), 'sha256'), 'hex');
  decrypted_value := pgp_sym_decrypt(encrypted_data, encryption_key);
  
  RETURN decrypted_value;
EXCEPTION
  WHEN OTHERS THEN
    -- Log failed decryption attempt
    PERFORM create_security_alert(
      'failed_pii_decryption',
      'high',
      jsonb_build_object(
        'field_name', field_name,
        'target_user_id', target_user_id,
        'error', SQLERRM
      )
    );
    RAISE;
END;
$$;

-- 6. Create a secure view that automatically masks sensitive data
CREATE OR REPLACE VIEW public.profiles_secure AS
SELECT 
  id,
  email,
  first_name,
  last_name,
  -- Masked fields
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN phone
    ELSE mask_phone(phone)
  END as phone,
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN address
    ELSE mask_address(address)
  END as address,
  city,
  state,
  zip_code,
  country,
  -- Always masked SSN (use decrypt function to access)
  mask_ssn(ssn_last_four) as ssn_display,
  -- Date of birth - only show year for unverified
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN date_of_birth
    ELSE NULL
  END as date_of_birth,
  kyc_status,
  kyc_submitted_at,
  kyc_verified_at,
  created_at,
  updated_at,
  metadata,
  data_classification
FROM public.profiles;

-- 7. Grant access to the secure view
GRANT SELECT ON public.profiles_secure TO authenticated;

-- 8. Create function to access unmasked sensitive field (KYC verified only)
CREATE OR REPLACE FUNCTION public.get_verified_pii_field(
  field_name text,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  field_value text;
  user_kyc_status text;
BEGIN
  -- Security checks
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Access denied: can only access own PII';
  END IF;
  
  -- Get KYC status
  SELECT kyc_status INTO user_kyc_status 
  FROM profiles 
  WHERE id = target_user_id;
  
  -- Only allow KYC verified users to access unmasked data
  IF user_kyc_status != 'verified' THEN
    RAISE EXCEPTION 'KYC verification required to access unmasked PII';
  END IF;
  
  -- Rate limiting
  IF NOT check_pii_rate_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Rate limit exceeded for PII access';
  END IF;
  
  -- Log high-risk access
  PERFORM log_high_risk_operation(
    'UNMASKED_PII_ACCESS',
    'profiles',
    ARRAY[field_name],
    4
  );
  
  -- Retrieve field based on field_name
  CASE field_name
    WHEN 'phone' THEN
      SELECT phone INTO field_value FROM profiles WHERE id = target_user_id;
    WHEN 'address' THEN
      SELECT address INTO field_value FROM profiles WHERE id = target_user_id;
    WHEN 'ssn_last_four' THEN
      -- Decrypt if encrypted, otherwise return legacy value
      SELECT 
        CASE 
          WHEN ssn_encrypted IS NOT NULL THEN decrypt_pii(ssn_encrypted, 'ssn_last_four', target_user_id)
          ELSE ssn_last_four
        END INTO field_value
      FROM profiles WHERE id = target_user_id;
    WHEN 'date_of_birth' THEN
      -- Decrypt if encrypted, otherwise return legacy value
      SELECT 
        CASE 
          WHEN dob_encrypted IS NOT NULL THEN decrypt_pii(dob_encrypted, 'date_of_birth', target_user_id)
          ELSE date_of_birth::text
        END INTO field_value
      FROM profiles WHERE id = target_user_id;
    ELSE
      RAISE EXCEPTION 'Invalid field name: %', field_name;
  END CASE;
  
  RETURN field_value;
END;
$$;

-- 9. Update profile update trigger to enforce encryption
CREATE OR REPLACE FUNCTION public.enforce_pii_encryption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Encrypt SSN if provided and not already encrypted
  IF NEW.ssn_last_four IS NOT NULL AND (OLD.ssn_last_four IS NULL OR NEW.ssn_last_four != OLD.ssn_last_four) THEN
    NEW.ssn_encrypted := encrypt_pii(NEW.ssn_last_four, 'ssn_last_four');
    -- Keep masked version in original column for legacy compatibility
    NEW.ssn_last_four := mask_ssn(NEW.ssn_last_four);
  END IF;
  
  -- Encrypt date of birth if provided and not already encrypted
  IF NEW.date_of_birth IS NOT NULL AND (OLD.date_of_birth IS NULL OR NEW.date_of_birth != OLD.date_of_birth) THEN
    NEW.dob_encrypted := encrypt_pii(NEW.date_of_birth::text, 'date_of_birth');
  END IF;
  
  -- Update last PII access timestamp
  NEW.last_pii_access := now();
  
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS enforce_pii_encryption_trigger ON public.profiles;
CREATE TRIGGER enforce_pii_encryption_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_pii_encryption();

-- Also handle INSERT operations
DROP TRIGGER IF EXISTS enforce_pii_encryption_insert_trigger ON public.profiles;
CREATE TRIGGER enforce_pii_encryption_insert_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_pii_encryption();

-- 10. Strengthen RLS policies with additional checks
DROP POLICY IF EXISTS "Users can only access own profile data" ON public.profiles;
DROP POLICY IF EXISTS "Enhanced user profile access" ON public.profiles;
CREATE POLICY "Enhanced user profile access"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  AND emergency_transaction_lockdown()  -- Check if system is not in lockdown
  AND validate_profile_access_pattern(auth.uid())  -- Validate access pattern
);

-- 11. Add comment documentation
COMMENT ON FUNCTION public.encrypt_pii IS 'Encrypts sensitive PII fields using user-specific encryption keys';
COMMENT ON FUNCTION public.decrypt_pii IS 'Decrypts sensitive PII with security checks, rate limiting, and audit logging';
COMMENT ON FUNCTION public.get_verified_pii_field IS 'Returns unmasked PII field for KYC verified users only with comprehensive security checks';
COMMENT ON VIEW public.profiles_secure IS 'Secure view of profiles table with automatic data masking based on KYC status';

-- 12. Create index for encrypted columns
CREATE INDEX IF NOT EXISTS idx_profiles_ssn_encrypted ON public.profiles(ssn_encrypted) WHERE ssn_encrypted IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_dob_encrypted ON public.profiles(dob_encrypted) WHERE dob_encrypted IS NOT NULL;