-- Fix pool_stats table security - restrict access to sensitive financial data
-- Only allow users to see pool stats for chains/tokens they have active locks in

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "Users can view pool statistics" ON public.pool_stats;

-- Create a more restrictive policy for pool_stats
CREATE POLICY "Users can view pool statistics for their active chains" 
ON public.pool_stats 
FOR SELECT 
USING (
  -- Users can only see pool stats for chains where they have active locks
  EXISTS (
    SELECT 1 FROM public.locks 
    WHERE locks.user_id = auth.uid() 
    AND locks.chain = pool_stats.chain
    AND locks.status IN ('active', 'matured')
  )
  OR 
  -- Or allow viewing stats for major chains to enable deposits (USDC chains only)
  (chain IN ('ethereum', 'arbitrum', 'optimism') AND token = 'USDC')
);

-- Improve password security by enabling leaked password protection
-- This will be handled via Supabase dashboard settings