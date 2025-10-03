-- Set up hourly cron job for balance verification
-- First, ensure pg_cron extension is enabled (should already be)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule balance verification to run every hour at minute 5
SELECT cron.schedule(
  'balance-verification-hourly',
  '5 * * * *', -- Run at 5 minutes past every hour
  $$
  SELECT net.http_post(
    url:='https://auntkvllzejtfqmousxg.supabase.co/functions/v1/verify-balances',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc5MzgyNSwiZXhwIjoyMDczMzY5ODI1fQ.3OxYTEk6kXC5RgfHN8VL9YN3p3Dl3HF-GXFRNcT1Ql4"}'::jsonb,
    body:='{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);

-- Create helper function to check cron status
CREATE OR REPLACE FUNCTION public.get_balance_verification_cron_status()
RETURNS TABLE(
  jobname TEXT,
  schedule TEXT,
  active BOOLEAN,
  database TEXT,
  username TEXT,
  jobid INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.jobname::TEXT,
    c.schedule::TEXT,
    c.active,
    c.database::TEXT,
    c.username::TEXT,
    c.jobid::INTEGER
  FROM cron.job c
  WHERE c.jobname = 'balance-verification-hourly';
END;
$$;