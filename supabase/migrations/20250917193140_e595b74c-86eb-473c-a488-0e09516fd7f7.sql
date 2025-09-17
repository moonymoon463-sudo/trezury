-- Fix the Security Definer View warning by restructuring data masking approach

-- 1. Drop the secure_profiles view that uses SECURITY DEFINER functions
DROP VIEW IF EXISTS secure_profiles;

-- 2. Recreate masking functions without SECURITY DEFINER to avoid the warning
CREATE OR REPLACE FUNCTION mask_ssn(ssn_value text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN ssn_value IS NULL THEN NULL
    WHEN length(ssn_value) >= 4 THEN '***-**-' || right(ssn_value, 4)
    ELSE '***-**-****'
  END;
$$;

CREATE OR REPLACE FUNCTION mask_phone(phone_value text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN phone_value IS NULL THEN NULL
    WHEN length(phone_value) >= 4 THEN '***-***-' || right(regexp_replace(phone_value, '[^0-9]', '', 'g'), 4)
    ELSE '***-***-****'
  END;
$$;

CREATE OR REPLACE FUNCTION mask_address(address_value text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN address_value IS NULL THEN NULL
    ELSE split_part(address_value, ' ', 1) || ' *** [PROTECTED]'
  END;
$$;

-- 3. Recreate the access control function without SECURITY DEFINER
CREATE OR REPLACE FUNCTION can_access_sensitive_pii(user_uuid uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  user_kyc_status text;
  is_same_user boolean;
BEGIN
  -- Check if accessing own data
  is_same_user := (user_uuid = target_user_id);
  
  -- Only allow access to own data
  IF NOT is_same_user THEN
    RETURN false;
  END IF;
  
  -- Get KYC status (this will be subject to RLS policies)
  SELECT kyc_status INTO user_kyc_status 
  FROM profiles 
  WHERE id = user_uuid;
  
  -- Allow full access only if KYC is verified
  RETURN (user_kyc_status = 'verified');
END;
$$;

-- 4. Create a safe profile view without SECURITY DEFINER functions
CREATE OR REPLACE VIEW safe_profiles AS
SELECT 
  id,
  email,
  first_name,
  last_name,
  country,
  kyc_status,
  created_at,
  updated_at,
  
  -- Use simple masking without SECURITY DEFINER functions
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN phone
    ELSE CASE 
      WHEN phone IS NULL THEN NULL
      WHEN length(phone) >= 4 THEN '***-***-' || right(regexp_replace(phone, '[^0-9]', '', 'g'), 4)
      ELSE '***-***-****'
    END
  END as phone,
  
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN ssn_last_four
    ELSE CASE 
      WHEN ssn_last_four IS NULL THEN NULL
      WHEN length(ssn_last_four) >= 4 THEN '***-**-' || right(ssn_last_four, 4)
      ELSE '***-**-****'
    END
  END as ssn_last_four,
  
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN address
    ELSE CASE 
      WHEN address IS NULL THEN NULL
      ELSE split_part(address, ' ', 1) || ' *** [PROTECTED]'
    END
  END as address,
  
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN city
    ELSE '*** [PROTECTED]'
  END as city,
  
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN state
    ELSE '**'
  END as state,
  
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN zip_code
    ELSE '*****'
  END as zip_code,
  
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN date_of_birth
    ELSE NULL
  END as date_of_birth

FROM profiles;

-- Grant access to the safe view
GRANT SELECT ON safe_profiles TO authenticated;

-- 5. Add comment explaining the security architecture
COMMENT ON VIEW safe_profiles IS 'Secure view that automatically masks sensitive PII based on user authentication and KYC verification status. Only verified users can see their own unmasked data.';

-- 6. Additional constraint to prevent unauthorized sensitive data storage
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS check_kyc_required_for_pii;

ALTER TABLE profiles 
ADD CONSTRAINT check_sensitive_data_requires_kyc 
CHECK (
  -- Allow empty sensitive fields regardless of KYC status
  (ssn_last_four IS NULL AND date_of_birth IS NULL AND address IS NULL) 
  OR 
  -- Or require KYC status to be set when sensitive data exists
  (kyc_status IS NOT NULL AND kyc_status IN ('verified', 'pending', 'rejected'))
);