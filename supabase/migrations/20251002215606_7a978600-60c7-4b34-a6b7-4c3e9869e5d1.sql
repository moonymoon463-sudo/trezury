-- Phase 1: Critical Security Hardening

-- 1. Fix Profiles RLS: Remove bypass and enforce fail-closed rate limit
DROP POLICY IF EXISTS "Users can view own profile with safe rate limit" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile with safe validation" ON public.profiles;

-- Drop and recreate rate limit function with corrected parameters
DROP FUNCTION IF EXISTS public.check_pii_rate_limit(uuid);

CREATE FUNCTION public.check_pii_rate_limit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz := now() - interval '1 minute';
  v_access_count int := 0;
  v_limit int := 50; -- per minute
BEGIN
  -- Count recent accesses from audit_log
  SELECT COUNT(*) INTO v_access_count
  FROM audit_log
  WHERE user_id = p_user_id
    AND table_name = 'profiles'
    AND timestamp > v_window_start;

  IF v_access_count >= v_limit THEN
    -- Signal security alert when exceeded
    PERFORM public.create_security_alert('pii_rate_limit_exceeded', 'medium',
      jsonb_build_object('user_id', p_user_id, 'count', v_access_count, 'limit', v_limit));
    RETURN false;
  END IF;

  RETURN true;

EXCEPTION WHEN OTHERS THEN
  -- Fail-closed and signal error
  PERFORM public.create_security_alert('pii_rate_limit_error', 'high',
    jsonb_build_object('user_id', p_user_id, 'error', SQLERRM));
  RETURN false;
END;
$$;

CREATE POLICY "Users can view own profile (rate-limited)"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id AND check_pii_rate_limit(auth.uid()));

CREATE POLICY "Users can update own profile (rate-limited)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id AND check_pii_rate_limit(auth.uid()))
WITH CHECK (auth.uid() = id AND check_pii_rate_limit(auth.uid()));

-- 2. Make auth_attempts immutable (remove UPDATE policy)
DROP POLICY IF EXISTS "Service role can update auth attempts" ON public.auth_attempts;

-- 3. Stop MoonPay email probing (validate against profiles.email)
DROP POLICY IF EXISTS "Users can insert only their MoonPay data" ON public.moonpay_customers;

CREATE POLICY "Users can insert only their MoonPay data"
ON public.moonpay_customers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND user_id IS NOT NULL
  AND email IS NOT NULL
  AND email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- 4. Create secure wallet metadata table for salted KDF
CREATE TABLE IF NOT EXISTS public.secure_wallet_metadata (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kdf_salt bytea NOT NULL,
  kdf_iterations integer NOT NULL DEFAULT 100000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.secure_wallet_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own secure wallet metadata"
ON public.secure_wallet_metadata
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at trigger
DROP TRIGGER IF EXISTS trg_secure_wallet_metadata_updated_at ON public.secure_wallet_metadata;
CREATE TRIGGER trg_secure_wallet_metadata_updated_at
BEFORE UPDATE ON public.secure_wallet_metadata
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Mark existing addresses as not created with password to force secure setup
UPDATE public.onchain_addresses
SET created_with_password = false,
    setup_method = COALESCE(setup_method, 'legacy_insecure')
WHERE created_with_password IS DISTINCT FROM false;