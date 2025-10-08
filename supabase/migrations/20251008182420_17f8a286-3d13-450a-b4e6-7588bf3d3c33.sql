-- Check and create the gold price collection cron job
-- First, unschedule any existing similar jobs
DO $$
DECLARE
  job_rec RECORD;
BEGIN
  -- Remove any existing gold-related cron jobs
  FOR job_rec IN 
    SELECT jobid 
    FROM cron.job 
    WHERE command LIKE '%gold-price-collector%'
  LOOP
    PERFORM cron.unschedule(job_rec.jobid);
  END LOOP;
END $$;

-- Create new cron job to run every minute
SELECT cron.schedule(
  'gold-price-collection-v2',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://auntkvllzejtfqmousxg.supabase.co/functions/v1/gold-price-collector',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3OTM4MjUsImV4cCI6MjA3MzM2OTgyNX0.h1ZLLv3XeqTW1Eo8qwRdADCMO6_6dM69yhX53ew4_pI"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);