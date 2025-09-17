-- Fix remaining function search path warnings

-- 1. Fix the user verification function
CREATE OR REPLACE FUNCTION user_can_see_sensitive_data()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND kyc_status = 'verified'
  );
$$;

-- 2. Fix the simple audit function
CREATE OR REPLACE FUNCTION simple_profile_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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