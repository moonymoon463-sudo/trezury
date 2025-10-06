-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule reconciliation to run every 5 minutes
SELECT cron.schedule(
  'reconcile-failed-transactions',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/reconcile-transactions',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Create a table to track relayer key metadata
CREATE TABLE IF NOT EXISTS public.relayer_key_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id TEXT NOT NULL UNIQUE,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotated', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.relayer_key_metadata ENABLE ROW LEVEL SECURITY;

-- Only admins can view key metadata
CREATE POLICY "Admins can view relayer key metadata"
  ON public.relayer_key_metadata
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Log the initial key setup
INSERT INTO public.relayer_key_metadata (key_id, status)
VALUES ('relayer_primary_key_v1', 'active');

-- Create a view to monitor reconciliation cron job status
CREATE OR REPLACE VIEW public.reconciliation_cron_status AS
SELECT 
  j.jobname,
  j.schedule,
  j.active,
  j.nodename,
  j.database,
  r.runid,
  r.status AS last_run_status,
  r.start_time AS last_run_start,
  r.end_time AS last_run_end,
  r.return_message AS last_run_message,
  CASE 
    WHEN r.end_time IS NULL THEN 'running'
    WHEN r.status::text = '200' THEN 'success'
    ELSE 'failed'
  END AS health_status
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT * FROM cron.job_run_details 
  WHERE jobid = j.jobid 
  ORDER BY start_time DESC 
  LIMIT 1
) r ON true
WHERE j.jobname = 'reconcile-failed-transactions';

-- Grant access to authenticated users
GRANT SELECT ON public.reconciliation_cron_status TO authenticated;

-- Create a function to get cron job health (admin only)
CREATE OR REPLACE FUNCTION public.get_reconciliation_cron_health()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Only admins can check cron health
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT json_build_object(
    'jobname', jobname,
    'schedule', schedule,
    'active', active,
    'last_run_status', last_run_status,
    'last_run_start', last_run_start,
    'last_run_end', last_run_end,
    'health_status', health_status,
    'last_run_message', last_run_message
  ) INTO result
  FROM public.reconciliation_cron_status;

  RETURN result;
END;
$$;

COMMENT ON TABLE public.relayer_key_metadata IS 'Tracks relayer private key rotation for security auditing';
COMMENT ON FUNCTION public.get_reconciliation_cron_health() IS 'Returns health status of the reconciliation cron job for admin monitoring';