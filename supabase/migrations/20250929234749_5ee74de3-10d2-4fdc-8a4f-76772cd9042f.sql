-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create hourly cron job for gold price collection
-- This will invoke the gold-price-collector function every hour
SELECT cron.schedule(
  'collect-gold-prices-hourly',
  '0 * * * *', -- Run at the start of every hour
  $$
  SELECT
    net.http_post(
      url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/gold-price-collector',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3OTM4MjUsImV4cCI6MjA3MzM2OTgyNX0.h1ZLLv3XeqTW1Eo8qwRdADCMO6_6dM69yhX53ew4_pI',
        'x-cron-secret', current_setting('app.settings.cron_secret', true)
      ),
      body := jsonb_build_object(
        'time', now()::text,
        'source', 'cron'
      )
    ) as request_id;
  $$
);

-- Store the CRON_SECRET in database config (you'll need to set the actual value)
-- Run this separately after adding the secret to Supabase dashboard:
-- ALTER DATABASE postgres SET app.settings.cron_secret = 'your-actual-secret-here';