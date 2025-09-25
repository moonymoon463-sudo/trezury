-- Create a simple test function that anyone can call
CREATE OR REPLACE FUNCTION public.test_gold_price_collection()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  result RECORD;
BEGIN
  -- Make HTTP request to the gold price collector
  SELECT INTO result net.http_post(
    url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/gold-price-collector',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3OTM4MjUsImV4cCI6MjA3MzM2OTgyNX0.h1ZLLv3XeqTW1Eo8qwRdADCMO6_6dM69yhX53ew4_pI"}'::jsonb,
    body := '{"test_call": true}'::jsonb
  );
  
  RETURN json_build_object(
    'success', true,
    'request_id', result,
    'message', 'Test gold price collection triggered',
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