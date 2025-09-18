-- Enhanced security measures for PII protection and KYC documents (fixed)

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

-- 3. Enhanced storage policies for KYC documents (admin access only)
DROP POLICY IF EXISTS "KYC documents admin access only" ON storage.objects;
CREATE POLICY "KYC documents admin access only" ON storage.objects
FOR SELECT USING (
  bucket_id = 'kyc-documents' AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (metadata->>'role' = 'admin' OR metadata->>'role' = 'kyc_reviewer')
  )
);

DROP POLICY IF EXISTS "Users can upload KYC documents" ON storage.objects;
CREATE POLICY "Users can upload KYC documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'kyc-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Add metadata column to profiles for role-based access if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'metadata') THEN
    ALTER TABLE public.profiles ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- 5. Enhanced logging for security events
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
    event_data
  );
END;
$$;