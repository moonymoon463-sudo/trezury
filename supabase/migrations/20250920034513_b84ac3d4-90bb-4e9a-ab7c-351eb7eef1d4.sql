-- Create user roles system for admin access control
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin');
$$;

-- RLS policies for user_roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Add admin functions for user management
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  kyc_status TEXT,
  role app_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if requesting user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.created_at,
    p.kyc_status,
    COALESCE(ur.role, 'user'::app_role) as role
  FROM profiles p
  LEFT JOIN user_roles ur ON p.id = ur.user_id
  ORDER BY p.created_at DESC;
END;
$$;

-- Function to assign roles
CREATE OR REPLACE FUNCTION public.admin_assign_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if requesting user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  INSERT INTO user_roles (user_id, role, assigned_by)
  VALUES (_user_id, _role, auth.uid())
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- Function to remove roles
CREATE OR REPLACE FUNCTION public.admin_remove_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if requesting user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  DELETE FROM user_roles 
  WHERE user_id = _user_id AND role = _role;

  RETURN TRUE;
END;
$$;

-- Create admin dashboard stats function
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check if requesting user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'verified_users', (SELECT COUNT(*) FROM profiles WHERE kyc_status = 'verified'),
    'total_transactions', (SELECT COUNT(*) FROM transactions),
    'total_volume_usd', (SELECT COALESCE(SUM(quantity * unit_price_usd), 0) FROM transactions WHERE status = 'completed'),
    'active_locks', (SELECT COUNT(*) FROM locks WHERE status = 'active'),
    'total_locked_value', (SELECT COALESCE(SUM(amount_dec), 0) FROM locks WHERE status = 'active'),
    'pending_kyc', (SELECT COUNT(*) FROM profiles WHERE kyc_status = 'pending'),
    'recent_signups', (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '7 days')
  ) INTO result;

  RETURN result;
END;
$$;