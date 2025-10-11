-- Add comments explaining why SECURITY DEFINER is needed
-- These functions use SECURITY DEFINER intentionally to prevent infinite recursion in RLS policies

COMMENT ON FUNCTION public.has_role(uuid, app_role) IS 
  'Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion when checking roles in RLS policies. This is the recommended pattern for role checks.';

COMMENT ON FUNCTION public.is_admin(uuid) IS 
  'Uses SECURITY DEFINER via has_role to check admin status. Required for RLS policy evaluation without recursion.';

COMMENT ON FUNCTION public.is_institutional_admin(uuid, uuid) IS 
  'Uses SECURITY DEFINER to check institutional admin status without RLS recursion.';

COMMENT ON FUNCTION public.is_team_member(uuid, uuid) IS 
  'Uses SECURITY DEFINER to check team membership without RLS recursion.';

COMMENT ON FUNCTION public.get_user_email(uuid) IS 
  'Uses SECURITY DEFINER to retrieve user email for RLS policy checks without recursion.';

COMMENT ON FUNCTION public.emergency_pii_lockdown_active() IS 
  'Uses SECURITY DEFINER to check emergency lockdown status without RLS recursion.';