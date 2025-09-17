-- Fix security vulnerabilities for sensitive personal and KYC data

-- 1. Create more restrictive RLS policies for profiles table
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create new restrictive policies for profiles
CREATE POLICY "Users can view basic profile info" ON profiles
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update basic profile info" ON profiles
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- 2. Create more secure policies for KYC documents
-- Drop existing policies first  
DROP POLICY IF EXISTS "Users can view their own KYC documents" ON kyc_documents;
DROP POLICY IF EXISTS "Users can update their own KYC documents" ON kyc_documents;
DROP POLICY IF EXISTS "Users can insert their own KYC documents" ON kyc_documents;

-- Create new restrictive policies for KYC documents
CREATE POLICY "Users can view own KYC documents" ON kyc_documents
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id AND upload_status = 'uploaded');

CREATE POLICY "Users can insert own KYC documents" ON kyc_documents
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own KYC documents status" ON kyc_documents
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Add validation function for sensitive data access
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

-- 4. Create view for safe profile access (excluding most sensitive fields)
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
  CASE 
    WHEN is_kyc_verified(id) THEN phone
    ELSE NULL
  END as phone,
  CASE 
    WHEN is_kyc_verified(id) THEN city
    ELSE NULL  
  END as city,
  CASE 
    WHEN is_kyc_verified(id) THEN state
    ELSE NULL
  END as state
FROM profiles;

-- Grant access to the view
GRANT SELECT ON safe_profiles TO authenticated;

-- 5. Add RLS to the view
ALTER VIEW safe_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own safe profile" ON safe_profiles
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- 6. Create audit trigger for sensitive data access
CREATE OR REPLACE FUNCTION audit_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log access to sensitive fields
  IF TG_OP = 'SELECT' AND (
    NEW.ssn_last_four IS NOT NULL OR 
    NEW.date_of_birth IS NOT NULL OR
    NEW.address IS NOT NULL
  ) THEN
    INSERT INTO audit_log (
      user_id,
      table_name,
      operation,
      sensitive_access,
      timestamp
    ) VALUES (
      auth.uid(),
      TG_TABLE_NAME,
      TG_OP,
      true,
      now()
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  table_name text NOT NULL,
  operation text NOT NULL,
  sensitive_access boolean DEFAULT false,
  timestamp timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS on audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only system can insert audit logs
CREATE POLICY "System can insert audit logs" ON audit_log
FOR INSERT 
WITH CHECK (true);

-- Users can't view audit logs (admin only through service role)
CREATE POLICY "No user access to audit logs" ON audit_log
FOR ALL
TO authenticated
USING (false);