-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job to run gold price collector every 10 minutes
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

-- Function to check cron job status
CREATE OR REPLACE FUNCTION public.get_gold_price_cron_status()
RETURNS TABLE(
  jobname TEXT,
  schedule TEXT,
  active BOOLEAN,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.jobname::TEXT,
    c.schedule::TEXT,
    c.active,
    c.last_run,
    CASE 
      WHEN c.active THEN 
        (SELECT cron.next_run_at(c.schedule::cron))
      ELSE NULL
    END as next_run
  FROM cron.job c
  WHERE c.jobname = 'gold-price-collection';
END;
$function$;