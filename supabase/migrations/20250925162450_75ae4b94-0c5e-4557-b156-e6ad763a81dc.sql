-- Enable required extensions for HTTP requests and cron jobs
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Test the gold price collection again after enabling extensions
SELECT cron.unschedule('gold-price-collection');

-- Re-create the cron job with proper extensions enabled
SELECT cron.schedule(
  'gold-price-collection',
  '*/10 * * * *', -- Every 10 minutes
  $$ 
  SELECT net.http_post(
    url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/gold-price-collector',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3OTM4MjUsImV4cCI6MjA3MzM2OTgyNX0.h1ZLLv3XeqTW1Eo8qwRdADCMO6_6dM69yhX53ew4_pI"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);