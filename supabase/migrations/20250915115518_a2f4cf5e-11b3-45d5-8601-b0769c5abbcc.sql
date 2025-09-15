-- Fix config table security - restrict access to admin users only
DROP POLICY IF EXISTS "Only authenticated users can view config" ON public.config;

-- Create restrictive policy for config table 
-- For now, block all user access since there's no admin role system
CREATE POLICY "Config restricted access" 
ON public.config FOR SELECT 
USING (false);