-- ============================================================================
-- PRE-LAUNCH SECURITY FIXES - DATABASE MIGRATION
-- ============================================================================

-- 1. FIX SECURITY DEFINER FUNCTIONS - Add SET search_path = public
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_institutional_admin(_user_id uuid, _account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
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
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members tm
    WHERE tm.user_id = _user_id
      AND tm.institutional_account_id = _account_id
  )
$$;

-- 2. CREATE SIGNATURE ATTEMPTS TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.signature_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  success boolean NOT NULL,
  chain_id integer NOT NULL,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_signature_attempts_user_time ON signature_attempts(user_id, created_at DESC);
CREATE INDEX idx_signature_attempts_failed ON signature_attempts(success, created_at DESC) WHERE success = false;

ALTER TABLE public.signature_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signature attempts"
ON public.signature_attempts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert signature attempts"
ON public.signature_attempts
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Admins can view all signature attempts"
ON public.signature_attempts
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- 3. CREATE API DOWNTIME LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_downtime_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  error_message text,
  error_details jsonb DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  duration_seconds integer GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (resolved_at - detected_at))::integer
  ) STORED
);

CREATE INDEX idx_api_downtime_provider ON api_downtime_log(provider, detected_at DESC);
CREATE INDEX idx_api_downtime_unresolved ON api_downtime_log(detected_at DESC) WHERE resolved_at IS NULL;

ALTER TABLE public.api_downtime_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view API downtime logs"
ON public.api_downtime_log
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role can manage API downtime logs"
ON public.api_downtime_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. ADD IDEMPOTENCY TRACKING TO TRANSACTIONS
-- ============================================================================

-- Add index for faster idempotency checks
CREATE INDEX IF NOT EXISTS idx_transactions_quote_user_status 
ON transactions(quote_id, user_id, status) 
WHERE status IN ('pending', 'completed');

-- 5. CREATE BALANCE CHANGE ALERTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.balance_change_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_total numeric NOT NULL,
  current_total numeric NOT NULL,
  percent_change numeric NOT NULL,
  balance_snapshot jsonb NOT NULL,
  alert_severity text NOT NULL CHECK (alert_severity IN ('low', 'medium', 'high', 'critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_balance_alerts_user ON balance_change_alerts(user_id, created_at DESC);
CREATE INDEX idx_balance_alerts_severity ON balance_change_alerts(alert_severity, created_at DESC);

ALTER TABLE public.balance_change_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own balance alerts"
ON public.balance_change_alerts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert balance alerts"
ON public.balance_change_alerts
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Admins can view all balance alerts"
ON public.balance_change_alerts
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

COMMENT ON TABLE signature_attempts IS 'Tracks all wallet signature attempts for security monitoring';
COMMENT ON TABLE api_downtime_log IS 'Logs external API (0x, etc.) downtime events';
COMMENT ON TABLE balance_change_alerts IS 'Logs unusual balance changes for fraud detection';