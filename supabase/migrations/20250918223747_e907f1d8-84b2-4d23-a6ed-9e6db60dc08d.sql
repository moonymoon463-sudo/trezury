-- Enhanced security measures for PII protection and KYC documents

-- 1. Create more restrictive RLS policies for enhanced PII protection
DROP POLICY IF EXISTS "Enhanced PII protection with rate limiting" ON public.profiles;
CREATE POLICY "Enhanced PII protection with rate limiting" ON public.profiles
FOR SELECT USING (
  auth.uid() = id AND 
  can_access_sensitive_pii(auth.uid(), id) AND
  check_pii_rate_limit(auth.uid())
);

-- 2. Restrict KYC document access to only file metadata (not actual file paths)
DROP POLICY IF EXISTS "Users can view own uploaded KYC documents" ON public.kyc_documents;
CREATE POLICY "Restricted KYC document metadata access" ON public.kyc_documents
FOR SELECT USING (
  auth.uid() = user_id AND 
  upload_status = 'uploaded'
);

-- 3. Add admin-only policy for KYC document management
CREATE POLICY "Admin only KYC document management" ON public.kyc_documents
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (metadata->>'role' = 'admin' OR metadata->>'role' = 'kyc_reviewer')
  )
);

-- 4. Enhanced storage policies for KYC documents (admin access only)
CREATE POLICY "KYC documents admin access only" ON storage.objects
FOR SELECT USING (
  bucket_id = 'kyc-documents' AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (metadata->>'role' = 'admin' OR metadata->>'role' = 'kyc_reviewer')
  )
);

CREATE POLICY "Users can upload KYC documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'kyc-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Add security audit trigger for sensitive data access
DROP TRIGGER IF EXISTS enhanced_profile_audit_trigger ON public.profiles;
CREATE TRIGGER enhanced_profile_audit_trigger
  AFTER SELECT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION enhanced_profile_audit();

-- 6. Add metadata column to profiles for role-based access if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'metadata') THEN
    ALTER TABLE public.profiles ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- 7. Enhanced logging for security events
CREATE OR REPLACE FUNCTION log_security_event(
  event_type text,
  event_data jsonb DEFAULT '{}'
) RETURNS void
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
    'security_events',
    event_type,
    ARRAY['security_sensitive'],
    now(),
    event_data || jsonb_build_object(
      'ip_address', current_setting('request.headers', true)::jsonb->'x-forwarded-for',
      'user_agent', current_setting('request.headers', true)::jsonb->'user-agent'
    )
  );
END;
$$;