-- Fix the cron status function to work with actual cron schema
DROP FUNCTION IF EXISTS public.get_gold_price_cron_status();

CREATE OR REPLACE FUNCTION public.get_gold_price_cron_status()
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
SET search_path = 'public'
AS $function$
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
  WHERE c.jobname = 'gold-price-collection';
END;
$function$;

-- Function to manually trigger gold price collection for testing
CREATE OR REPLACE FUNCTION public.trigger_gold_price_collection()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  result RECORD;
BEGIN
  -- Only allow admins to trigger manually
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('error', 'Admin access required');
  END IF;
  
  -- Make HTTP request to the gold price collector
  SELECT INTO result net.http_post(
    url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/gold-price-collector',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3OTM4MjUsImV4cCI6MjA3MzM2OTgyNX0.h1ZLLv3XeqTW1Eo8qwRdADCMO6_6dM69yhX53ew4_pI"}'::jsonb,
    body := '{"manual_trigger": true}'::jsonb
  );
  
  RETURN json_build_object(
    'success', true,
    'request_id', result,
    'message', 'Gold price collection triggered manually'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'error', SQLERRM,
    'success', false
  );
END;
$function$;