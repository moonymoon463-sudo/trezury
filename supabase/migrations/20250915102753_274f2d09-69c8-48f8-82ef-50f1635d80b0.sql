-- Fix security issues

-- Update config table RLS to restrict access to admin users only
DROP POLICY IF EXISTS "Only authenticated users can view config" ON public.config;

-- Create admin-only policy for config table (for now, we'll restrict to no user access since there's no admin role system)
CREATE POLICY "Config restricted access" 
ON public.config FOR SELECT 
USING (false); -- Temporarily block all access until admin role system is implemented

-- Alternative: If you want to allow specific users, you could do:
-- USING (auth.jwt() ->> 'email' = 'admin@yourcompany.com');

-- Ensure leaked password protection is properly enabled
UPDATE auth.config 
SET enable_leaked_password_protection = true
WHERE enable_leaked_password_protection = false;