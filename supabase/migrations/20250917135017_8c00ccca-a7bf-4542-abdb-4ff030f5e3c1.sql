-- Add RLS policy to restrict pool_stats access to authenticated users only
ALTER TABLE public.pool_stats ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read pool stats
CREATE POLICY "Authenticated users can read pool stats" 
ON public.pool_stats 
FOR SELECT 
USING (auth.role() = 'authenticated');