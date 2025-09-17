-- Remove the overly permissive policy that allows anyone to view pool stats
DROP POLICY IF EXISTS "Anyone can view pool stats" ON public.pool_stats;

-- The "Authenticated users can read pool stats" policy should now be the only SELECT policy,
-- properly restricting access to authenticated users only