-- Drop the problematic policy that's blocking profile access
DROP POLICY IF EXISTS "users_own_profile_access" ON public.profiles;

-- Create a simple SELECT policy for users to view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Keep the rate-limited UPDATE policy
-- (The existing "Users can update own profile (rate-limited)" policy already handles this)