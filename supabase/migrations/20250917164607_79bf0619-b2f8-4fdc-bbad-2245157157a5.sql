-- Complete security lockdown of pool_stats table
-- Remove all user access, make it backend/admin only

-- Drop all existing policies on pool_stats
DROP POLICY IF EXISTS "Users can view pool statistics for their active chains" ON public.pool_stats;
DROP POLICY IF EXISTS "Users can view pool statistics" ON public.pool_stats;
DROP POLICY IF EXISTS "Authenticated users can read pool stats" ON public.pool_stats;
DROP POLICY IF EXISTS "System can update pool stats" ON public.pool_stats;

-- Create admin-only policies (no user access whatsoever)
CREATE POLICY "System service role only access" 
ON public.pool_stats 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Ensure no regular users can access pool_stats at all
CREATE POLICY "Block all user access to pool stats" 
ON public.pool_stats 
FOR ALL 
TO authenticated
USING (false);