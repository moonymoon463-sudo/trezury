-- Fix critical security vulnerability in auth_attempts table
-- Remove public read access and restrict to admin-only viewing

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Service role manages auth attempts" ON public.auth_attempts;

-- Create secure policies for auth_attempts table
-- Only service role can insert/update authentication attempts
CREATE POLICY "Service role can insert auth attempts" 
ON public.auth_attempts 
FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role can update auth attempts" 
ON public.auth_attempts 
FOR UPDATE 
TO service_role 
USING (true);

-- Only admins can view auth attempts for security monitoring
CREATE POLICY "Admins can view auth attempts" 
ON public.auth_attempts 
FOR SELECT 
USING (public.is_admin(auth.uid()));

-- No one can delete auth attempts (preserve audit trail)
-- DELETE is implicitly denied by not having a policy