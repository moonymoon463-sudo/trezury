-- Fix the cron job to run in a proper transaction context
-- First unschedule the existing job
SELECT cron.unschedule('gold-price-collection');

-- Create a stored procedure that the cron job can call
CREATE OR REPLACE FUNCTION public.collect_gold_prices()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  result RECORD;
  response_text TEXT;
BEGIN
  -- Make HTTP request to the gold price collector
  SELECT INTO result net.http_post(
    url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/gold-price-collector',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc5MzgyNSwiZXhwIjoyMDczMzY5ODI1fQ.3OxYTEk6kXC5RgfHN8VL9YN3p3Dl3HF-GXFRNcT1Ql4"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  );
  
  RETURN json_build_object(
    'success', true,
    'request_id', result,
    'message', 'Gold price collection triggered by cron',
    'timestamp', now()
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'error', SQLERRM,
    'success', false,
    'timestamp', now()
  );
END;
$function$;

-- Re-create the cron job to call our stored procedure
SELECT cron.schedule(
  'gold-price-collection',
  '*/10 * * * *', -- Every 10 minutes
  'SELECT public.collect_gold_prices();'
);