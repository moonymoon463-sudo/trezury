-- Fix critical security issue: Missing RLS INSERT policy on user_roles
-- This prevents non-admins from granting themselves admin privileges

CREATE POLICY "Only admins can assign roles"
ON public.user_roles 
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));