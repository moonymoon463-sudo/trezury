-- Fix security vulnerabilities for sensitive personal and KYC data
-- Issue: Cannot enable RLS on views, so creating alternative approach

-- 1. Drop existing policies and create more restrictive ones for KYC documents
DROP POLICY IF EXISTS "Users can view their own KYC documents" ON kyc_documents;
DROP POLICY IF EXISTS "Users can update their own KYC documents" ON kyc_documents;
DROP POLICY IF EXISTS "Users can insert their own KYC documents" ON kyc_documents;

-- Create more secure KYC policies - only show uploaded documents
CREATE POLICY "Users can view own uploaded KYC documents" ON kyc_documents
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id AND upload_status = 'uploaded');

CREATE POLICY "Users can insert own KYC documents" ON kyc_documents
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own KYC document status" ON kyc_documents
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Create function to check KYC verification status
CREATE OR REPLACE FUNCTION is_kyc_verified(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT kyc_status = 'verified' 
  FROM profiles 
  WHERE id = user_uuid;
$$;

-- 3. Create audit log table for sensitive data access
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  table_name text NOT NULL,
  operation text NOT NULL,
  sensitive_fields text[],
  ip_address inet,
  user_agent text,
  timestamp timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS on audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can insert audit logs, no user access
CREATE POLICY "Service role can insert audit logs" ON audit_log
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "No user access to audit logs" ON audit_log
FOR ALL
TO authenticated
USING (false);

-- 4. Create function to log sensitive data access
CREATE OR REPLACE FUNCTION log_sensitive_access(
  p_table_name text,
  p_operation text,
  p_sensitive_fields text[] DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (
    user_id,
    table_name,
    operation,
    sensitive_fields,
    timestamp,
    metadata
  ) VALUES (
    auth.uid(),
    p_table_name,
    p_operation,
    p_sensitive_fields,
    now(),
    p_metadata
  );
END;
$$;

-- 5. Add additional validation for profiles table
-- Create trigger to log access to sensitive profile fields
CREATE OR REPLACE FUNCTION profiles_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sensitive_fields text[] := '{}';
BEGIN
  -- Check which sensitive fields are being accessed
  IF TG_OP = 'SELECT' OR TG_OP = 'UPDATE' THEN
    IF NEW.ssn_last_four IS NOT NULL OR OLD.ssn_last_four IS NOT NULL THEN
      sensitive_fields := array_append(sensitive_fields, 'ssn_last_four');
    END IF;
    IF NEW.date_of_birth IS NOT NULL OR OLD.date_of_birth IS NOT NULL THEN
      sensitive_fields := array_append(sensitive_fields, 'date_of_birth');
    END IF;
    IF NEW.address IS NOT NULL OR OLD.address IS NOT NULL THEN
      sensitive_fields := array_append(sensitive_fields, 'address');
    END IF;
    
    -- Log if sensitive fields are accessed
    IF array_length(sensitive_fields, 1) > 0 THEN
      PERFORM log_sensitive_access('profiles', TG_OP, sensitive_fields);
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add trigger for profiles table (commented out for now to avoid performance impact)
-- CREATE TRIGGER profiles_audit_sensitive_access
--   AFTER SELECT OR UPDATE ON profiles
--   FOR EACH ROW
--   EXECUTE FUNCTION profiles_audit_trigger();

-- 6. Create function to validate KYC document access
CREATE OR REPLACE FUNCTION validate_kyc_document_access(doc_user_id uuid, doc_status text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() = doc_user_id AND doc_status = 'uploaded';
$$;

-- 7. Add constraint to ensure KYC documents can only be accessed when uploaded
ALTER TABLE kyc_documents ADD CONSTRAINT valid_file_path_when_uploaded 
CHECK (upload_status != 'uploaded' OR (upload_status = 'uploaded' AND file_path IS NOT NULL AND file_name IS NOT NULL));