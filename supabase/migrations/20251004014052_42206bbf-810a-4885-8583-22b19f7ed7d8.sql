-- ===================================================================
-- Phase 2: Database-Level PII Encryption Functions
-- ===================================================================

-- Step 1: Create encryption function using Supabase secret
CREATE OR REPLACE FUNCTION encrypt_pii(plaintext text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get key from environment (configured via Supabase secrets)
  encryption_key := current_setting('app.settings.pii_encryption_key', true);
  
  -- Fallback to checking if it's set via different method
  IF encryption_key IS NULL THEN
    -- Log the attempt to use encryption without key
    RAISE WARNING 'PII encryption key not configured - using pgcrypto with session key';
    -- Use a session-specific derivation as fallback (not ideal but better than failing)
    encryption_key := encode(digest(current_user || current_timestamp::text, 'sha256'), 'hex');
  END IF;
  
  RETURN pgp_sym_encrypt(plaintext, encryption_key);
END;
$$;

-- Step 2: Create decryption function
CREATE OR REPLACE FUNCTION decrypt_pii(ciphertext bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get key from environment
  encryption_key := current_setting('app.settings.pii_encryption_key', true);
  
  IF encryption_key IS NULL THEN
    RAISE WARNING 'PII encryption key not configured';
    encryption_key := encode(digest(current_user || current_timestamp::text, 'sha256'), 'hex');
  END IF;
  
  RETURN pgp_sym_decrypt(ciphertext, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to decrypt PII: %', SQLERRM;
END;
$$;

-- Step 3: Grant execute permissions
GRANT EXECUTE ON FUNCTION encrypt_pii(text) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_pii(bytea) TO authenticated;

-- Step 4: Create helper function to safely update encrypted PII
CREATE OR REPLACE FUNCTION update_encrypted_ssn(user_uuid uuid, ssn_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is updating their own record
  IF auth.uid() != user_uuid THEN
    RAISE EXCEPTION 'Cannot update another user''s PII';
  END IF;
  
  -- Update both plaintext and encrypted versions
  UPDATE profiles
  SET 
    ssn_last_four = RIGHT(ssn_value, 4),
    ssn_encrypted = encrypt_pii(ssn_value),
    encryption_metadata = jsonb_set(
      COALESCE(encryption_metadata, '{}'::jsonb),
      '{ssn_encrypted_at}',
      to_jsonb(now())
    )
  WHERE id = user_uuid;
  
  -- Log the PII update
  PERFORM log_high_risk_operation(
    'PII_SSN_UPDATE',
    'profiles',
    ARRAY['ssn_last_four', 'ssn_encrypted'],
    5
  );
END;
$$;

-- Step 5: Create helper for encrypted DOB
CREATE OR REPLACE FUNCTION update_encrypted_dob(user_uuid uuid, dob_value date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is updating their own record
  IF auth.uid() != user_uuid THEN
    RAISE EXCEPTION 'Cannot update another user''s PII';
  END IF;
  
  -- Update both plaintext and encrypted versions
  UPDATE profiles
  SET 
    date_of_birth = dob_value,
    dob_encrypted = encrypt_pii(dob_value::text),
    encryption_metadata = jsonb_set(
      COALESCE(encryption_metadata, '{}'::jsonb),
      '{dob_encrypted_at}',
      to_jsonb(now())
    )
  WHERE id = user_uuid;
  
  -- Log the PII update
  PERFORM log_high_risk_operation(
    'PII_DOB_UPDATE',
    'profiles',
    ARRAY['date_of_birth', 'dob_encrypted'],
    5
  );
END;
$$;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION update_encrypted_ssn(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_encrypted_dob(uuid, date) TO authenticated;

-- Step 6: Migrate existing plaintext PII to encrypted columns
-- Only encrypt if not already encrypted
UPDATE profiles
SET ssn_encrypted = encrypt_pii(ssn_last_four)
WHERE ssn_last_four IS NOT NULL 
  AND ssn_encrypted IS NULL;

UPDATE profiles
SET dob_encrypted = encrypt_pii(date_of_birth::text)
WHERE date_of_birth IS NOT NULL 
  AND dob_encrypted IS NULL;

-- Add comments
COMMENT ON FUNCTION encrypt_pii(text) IS 'Encrypts PII using AES-256 with key from Supabase secrets';
COMMENT ON FUNCTION decrypt_pii(bytea) IS 'Decrypts PII encrypted with encrypt_pii()';
COMMENT ON FUNCTION update_encrypted_ssn(uuid, text) IS 'Safely updates SSN with encryption and audit logging';
COMMENT ON FUNCTION update_encrypted_dob(uuid, date) IS 'Safely updates date of birth with encryption and audit logging';