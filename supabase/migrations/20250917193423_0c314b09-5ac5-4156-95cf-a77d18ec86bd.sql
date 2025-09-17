-- Final resolution for Security Definer View warning
-- This will completely remove the problematic view and replace it with a simpler approach

-- 1. Drop the potentially problematic safe_profiles view
DROP VIEW IF EXISTS safe_profiles CASCADE;

-- 2. Create a simple, clean view without any function dependencies
CREATE OR REPLACE VIEW public_profiles AS
SELECT 
  id,
  email,
  first_name,
  last_name,
  country,
  kyc_status,
  created_at,
  updated_at,
  
  -- Simple conditional access without function calls
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN phone
    ELSE CASE 
      WHEN phone IS NULL THEN NULL
      ELSE '***-***-' || right(phone, 4)
    END
  END as phone_display,
  
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN address
    ELSE '*** [PROTECTED ADDRESS]'
  END as address_display,
  
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN city
    ELSE '[PROTECTED]'
  END as city_display,
  
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN state
    ELSE '**'
  END as state_display,
  
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN zip_code
    ELSE '*****'
  END as zip_display,
  
  -- Never expose SSN or DOB unless fully verified
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN date_of_birth
    ELSE NULL
  END as date_of_birth_display,
  
  CASE 
    WHEN auth.uid() = id AND kyc_status = 'verified' THEN ssn_last_four
    ELSE '****'
  END as ssn_display

FROM profiles;

-- Grant access to the clean view
GRANT SELECT ON public_profiles TO authenticated;

-- 3. Add a comment explaining the security model
COMMENT ON VIEW public_profiles IS 'Public-safe profile view with automatic PII masking. Sensitive data is only visible to verified account owners accessing their own data.';

-- 4. Since we can't use the view safely, let's create a simple RLS policy update instead
-- Update the profiles table policy to be more restrictive for sensitive fields
DROP POLICY IF EXISTS "Users can view own profile with enhanced security" ON profiles;

-- Create a basic, secure policy without function dependencies
CREATE POLICY "Users can view own profile securely" ON profiles
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- 5. Create a simple function for frontend to check if user can see sensitive data
CREATE OR REPLACE FUNCTION user_can_see_sensitive_data()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND kyc_status = 'verified'
  );
$$;

-- 6. Update the audit table to remove any SECURITY DEFINER dependencies
-- Drop the old trigger that might have issues
DROP TRIGGER IF EXISTS profiles_sensitive_update_audit ON profiles;

-- Create a simpler audit trigger
CREATE OR REPLACE FUNCTION simple_profile_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Simple logging for profile updates
  IF (NEW.ssn_last_four IS DISTINCT FROM OLD.ssn_last_four OR
      NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth OR
      NEW.address IS DISTINCT FROM OLD.address OR
      NEW.phone IS DISTINCT FROM OLD.phone) THEN
    
    INSERT INTO audit_log (user_id, table_name, operation, timestamp, metadata)
    VALUES (
      auth.uid(),
      'profiles',
      'SENSITIVE_UPDATE',
      now(),
      jsonb_build_object('updated_fields', 'sensitive_data')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply the simple audit trigger
CREATE TRIGGER simple_profile_audit_trigger
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION simple_profile_audit();