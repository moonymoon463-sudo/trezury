-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view institutional accounts they belong to" ON institutional_accounts;
DROP POLICY IF EXISTS "Institutional admins can update their accounts" ON institutional_accounts;
DROP POLICY IF EXISTS "Admin emails can create institutional accounts" ON institutional_accounts;
DROP POLICY IF EXISTS "Team members can view institutional compliance reports" ON compliance_reports;

-- Create security definer functions to break recursion
CREATE OR REPLACE FUNCTION public.is_institutional_admin(_user_id uuid, _account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM institutional_accounts ia
    WHERE ia.id = _account_id
      AND ia.admin_email = (
        SELECT email FROM profiles WHERE id = _user_id
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members tm
    WHERE tm.user_id = _user_id
      AND tm.institutional_account_id = _account_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM profiles WHERE id = _user_id
$$;

-- Recreate institutional_accounts policies using security definer functions
CREATE POLICY "Admin emails can create institutional accounts"
ON institutional_accounts
FOR INSERT
TO authenticated
WITH CHECK (
  admin_email = public.get_user_email(auth.uid())
);

CREATE POLICY "Institutional admins can update their accounts"
ON institutional_accounts
FOR UPDATE
TO authenticated
USING (
  public.is_institutional_admin(auth.uid(), id)
);

CREATE POLICY "Users can view institutional accounts they belong to"
ON institutional_accounts
FOR SELECT
TO authenticated
USING (
  public.is_institutional_admin(auth.uid(), id)
  OR public.is_team_member(auth.uid(), id)
);

-- Fix compliance_reports policy
CREATE POLICY "Team members can view institutional compliance reports"
ON compliance_reports
FOR SELECT
TO authenticated
USING (
  public.is_team_member(auth.uid(), institutional_account_id)
  OR public.is_institutional_admin(auth.uid(), institutional_account_id)
);