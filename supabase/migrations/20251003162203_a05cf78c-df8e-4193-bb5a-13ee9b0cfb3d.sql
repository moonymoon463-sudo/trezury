-- Phase 1: Critical Security Fixes
-- 1.1 Lock Down team_members Table

-- Revoke all public access to team_members
REVOKE ALL ON public.team_members FROM anon, authenticated;

-- Only institutional admins and team members themselves can read
CREATE POLICY team_members_read_restricted ON public.team_members
  FOR SELECT
  USING (
    auth.uid() = user_id  -- Can see own record
    OR
    EXISTS (  -- Or is admin of the institution
      SELECT 1 FROM institutional_accounts ia
      WHERE ia.id = team_members.institutional_account_id
        AND ia.admin_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );

-- Only institutional admins can insert/update
CREATE POLICY team_members_admin_write ON public.team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM institutional_accounts ia
      WHERE ia.id = team_members.institutional_account_id
        AND ia.admin_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );

-- 1.2 Implement PII Field-Level Encryption & Masking

-- Create masked profiles view for non-privileged access
CREATE OR REPLACE VIEW v_profiles_masked AS
SELECT
  id,
  email,
  CASE 
    WHEN auth.uid() = id THEN first_name
    ELSE left(coalesce(first_name, ''), 1) || '***'
  END as first_name,
  CASE 
    WHEN auth.uid() = id THEN last_name  
    ELSE left(coalesce(last_name, ''), 1) || '***'
  END as last_name,
  CASE
    WHEN auth.uid() = id THEN phone
    ELSE mask_phone(phone)
  END as phone,
  CASE
    WHEN auth.uid() = id THEN address
    ELSE mask_address(address)
  END as address,
  city,
  state,
  zip_code,
  country,
  CASE
    WHEN auth.uid() = id THEN date_of_birth
    ELSE NULL
  END as date_of_birth,
  ssn_last_four,  -- Already masked
  kyc_status,
  created_at,
  updated_at,
  metadata
FROM profiles;

-- Grant access to masked view
GRANT SELECT ON v_profiles_masked TO authenticated;

-- Update profiles RLS to be more restrictive
DROP POLICY IF EXISTS "Users can view own profile (rate-limited)" ON profiles;

-- Self read with rate limiting
CREATE POLICY profiles_self_read_ratelimited ON profiles
  FOR SELECT
  USING (
    auth.uid() = id 
    AND check_pii_rate_limit(auth.uid())
  );

-- Admins can read all but with logging
CREATE POLICY profiles_admin_read ON profiles
  FOR SELECT
  USING (
    is_admin(auth.uid())
    AND (SELECT log_high_risk_operation('ADMIN_PII_ACCESS', 'profiles', ARRAY['full_pii'], 5)) IS NOT NULL
  );

-- 1.3 Enable Balance Reconciliation Cron

-- Schedule balance verification to run hourly
SELECT cron.schedule(
  'balance-verification-hourly',
  '5 * * * *',  -- Every hour at :05
  $$
  SELECT net.http_post(
    url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/verify-balances',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc5MzgyNSwiZXhwIjoyMDczMzY5ODI1fQ.3OxYTEk6kXC5RgfHN8VL9YN3p3Dl3HF-GXFRNcT1Ql4"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  );
  $$
);

-- Create helper function to check cron status
CREATE OR REPLACE FUNCTION public.check_balance_verification_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_status RECORD;
  result JSON;
BEGIN
  -- Check if job exists and is active
  SELECT 
    jobname,
    schedule,
    active,
    jobid
  INTO job_status
  FROM cron.job 
  WHERE jobname = 'balance-verification-hourly';
  
  IF job_status.jobname IS NULL THEN
    result := json_build_object(
      'configured', false,
      'message', 'Balance verification cron job not found'
    );
  ELSE
    result := json_build_object(
      'configured', true,
      'active', job_status.active,
      'schedule', job_status.schedule,
      'job_id', job_status.jobid,
      'message', 'Balance verification is ' || CASE WHEN job_status.active THEN 'active' ELSE 'inactive' END
    );
  END IF;
  
  RETURN result;
END;
$$;