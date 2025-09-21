-- Schedule automated interest accrual to run every hour
-- This will trigger compound interest calculations and rate updates

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the auto-accrual function to run every hour
SELECT cron.schedule(
  'auto-accrual-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://auntkvllzejtfqmousxg.supabase.co/functions/v1/auto-accrual',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5OTk5OTk5OSwiZXhwIjoyMDE1NTc1OTk5fQ.dummy"}'::jsonb,
        body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Fix search path security warnings for functions
ALTER FUNCTION update_pool_statistics() SET search_path = public;
ALTER FUNCTION accrue_compound_interest() SET search_path = public;
ALTER FUNCTION distribute_governance_rewards() SET search_path = public;