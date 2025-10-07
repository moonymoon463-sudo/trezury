-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily fee collection at 2 AM UTC
-- This will trigger the fee-collection-api edge function to batch transfer accumulated fees
SELECT cron.schedule(
  'daily-fee-collection',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/fee-collection-api/pending-requests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc5MzgyNSwiZXhwIjoyMDczMzY5ODI1fQ.3OxYTEk6kXC5RgfHN8VL9YN3p3Dl3HF-GXFRNcT1Ql4',
      'x-api-key', 'dev-test-key-12345'
    )
  ) as request_id;
  $$
);

-- Query to check cron job status:
-- SELECT jobname, schedule, active, jobid FROM cron.job WHERE jobname = 'daily-fee-collection';