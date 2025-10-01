-- Drop the overly restrictive policy that requires rate limiting for all profile views
DROP POLICY IF EXISTS "Users can view own profile with rate limiting" ON public.profiles;

-- Create a simple policy for viewing own profile without rate limiting
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);