-- Fix remaining security policy issues

-- 1. Remove duplicate UPDATE policy on profiles table
DROP POLICY IF EXISTS "Users can update own profile with logging" ON profiles;

-- 2. Restrict audit log insertions to authorized functions only
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_log;

CREATE POLICY "Authorized functions can insert audit logs" 
ON audit_log 
FOR INSERT 
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role' AND
  auth.jwt() ->> 'iss' = 'supabase'
);

-- 3. Restrict payout insertions to authorized service only
DROP POLICY IF EXISTS "System can create payouts" ON payouts;

CREATE POLICY "Authorized lending service can create payouts" 
ON payouts 
FOR INSERT 
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role' AND
  auth.jwt() ->> 'aud' = 'authenticated'
);