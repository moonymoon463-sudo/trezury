-- Phase 5D: Admin MFA Enforcement

-- Create admin MFA tracking table
CREATE TABLE IF NOT EXISTS public.admin_mfa_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mfa_enabled boolean NOT NULL DEFAULT false,
  mfa_verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_mfa_status ENABLE ROW LEVEL SECURITY;

-- Policies for MFA status
CREATE POLICY "Users can view their own MFA status"
ON public.admin_mfa_status FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own MFA status"
ON public.admin_mfa_status FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify their own MFA status"
ON public.admin_mfa_status FOR UPDATE
USING (auth.uid() = user_id);

-- Enhanced admin check with MFA requirement
CREATE OR REPLACE FUNCTION public.is_admin_with_mfa(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_mfa_enabled boolean;
BEGIN
  -- Check if user has admin role
  SELECT public.has_role(_user_id, 'admin') INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN false;
  END IF;
  
  -- For admin users, check MFA status
  SELECT mfa_enabled INTO v_mfa_enabled
  FROM admin_mfa_status
  WHERE user_id = _user_id;
  
  -- If MFA record doesn't exist, create warning
  IF v_mfa_enabled IS NULL THEN
    INSERT INTO security_alerts (
      user_id,
      alert_type,
      severity,
      title,
      description,
      metadata
    ) VALUES (
      _user_id,
      'admin_mfa_required',
      'high',
      'Admin MFA Not Configured',
      'This admin account needs MFA enabled for security',
      jsonb_build_object('timestamp', now())
    ) ON CONFLICT DO NOTHING;
    
    -- Allow access but flag for MFA setup
    RETURN true;
  END IF;
  
  -- MFA must be enabled for full admin access
  RETURN v_mfa_enabled;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_with_mfa TO authenticated;

-- Update trigger for updated_at
CREATE TRIGGER update_admin_mfa_status_updated_at
BEFORE UPDATE ON public.admin_mfa_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();