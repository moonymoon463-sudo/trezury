-- Fix the swap-intent-reconciliation cron job
-- First, unschedule the broken job if it exists
SELECT cron.unschedule('swap-intent-reconciliation');

-- Recreate the cron job with proper JSON body construction
SELECT cron.schedule(
  'swap-intent-reconciliation',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://auntkvllzejtfqmousxg.supabase.co/functions/v1/swap-intent-reconciliation',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3OTM4MjUsImV4cCI6MjA3MzM2OTgyNX0.h1ZLLv3XeqTW1Eo8qwRdADCMO6_6dM69yhX53ew4_pI"}'::jsonb,
        body:=jsonb_build_object('time', now()::text)
    ) as request_id;
  $$
);

-- Trigger an immediate reconciliation to clean up stuck intents
SELECT
  net.http_post(
      url:='https://auntkvllzejtfqmousxg.supabase.co/functions/v1/swap-intent-reconciliation',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3OTM4MjUsImV4cCI6MjA3MzM2OTgyNX0.h1ZLLv3XeqTW1Eo8qwRdADCMO6_6dM69yhX53ew4_pI"}'::jsonb,
      body:=jsonb_build_object('manual_trigger', true, 'time', now()::text)
  ) as request_id;