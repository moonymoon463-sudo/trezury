-- Additional security enhancements for PII protection

-- Create function to encrypt sensitive data
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_field(input_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simple obfuscation for demo (in production, use proper encryption)
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return encrypted/hashed version (simplified for demo)
  RETURN encode(digest(input_text || 'salt_key_' || auth.uid()::text, 'sha256'), 'hex');
END;
$$;

-- Create enhanced audit table for sensitive operations
CREATE TABLE IF NOT EXISTS public.security_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  operation text NOT NULL,
  table_name text NOT NULL,
  sensitive_fields text[],
  ip_address inet,
  user_agent text,
  risk_score integer DEFAULT 0,
  timestamp timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS on security audit
ALTER TABLE public.security_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view security audit
CREATE POLICY "Admin only access to security audit" 
ON public.security_audit 
FOR ALL 
USING (false);  -- Block all access by default

-- Create function to log high-risk operations
CREATE OR REPLACE FUNCTION public.log_high_risk_operation(
  operation_type text,
  target_table text,
  fields text[] DEFAULT NULL,
  risk_level integer DEFAULT 5
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit (
    user_id,
    operation,
    table_name,
    sensitive_fields,
    risk_score,
    metadata
  ) VALUES (
    auth.uid(),
    operation_type,
    target_table,
    fields,
    risk_level,
    jsonb_build_object(
      'timestamp', now(),
      'session_id', auth.jwt() ->> 'sub'
    )
  );
END;
$$;