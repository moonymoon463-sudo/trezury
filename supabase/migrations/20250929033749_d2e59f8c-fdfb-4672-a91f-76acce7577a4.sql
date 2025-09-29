-- Set up automated news collection using pg_cron
-- First enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule news collection to run every 4 hours
SELECT cron.schedule(
  'financial-news-collection',
  '0 */4 * * *', -- Every 4 hours
  $$
  SELECT
    net.http_post(
        url:='https://auntkvllzejtfqmousxg.supabase.co/functions/v1/financial-news-collector',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc5MzgyNSwiZXhwIjoyMDczMzY5ODI1fQ.3OxYTEk6kXC5RgfHN8VL9YN3p3Dl3HF-GXFRNcT1Ql4"}'::jsonb,
        body:=concat('{"scheduled": true, "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Also add a manual trigger function for admins
CREATE OR REPLACE FUNCTION public.trigger_financial_news_collection()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result RECORD;
BEGIN
  -- Only allow admins to trigger manually
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('error', 'Admin access required');
  END IF;
  
  -- Make HTTP request to the financial news collector
  SELECT INTO result net.http_post(
    url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/financial-news-collector',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc5MzgyNSwiZXhwIjoyMDczMzY5ODI1fQ.3OxYTEk6kXC5RgfHN8VL9YN3p3Dl3HF-GXFRNcT1Ql4"}'::jsonb,
    body := '{"manual_trigger": true}'::jsonb
  );
  
  RETURN json_build_object(
    'success', true,
    'request_id', result,
    'message', 'Financial news collection triggered manually'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'error', SQLERRM,
    'success', false
  );
END;
$$;