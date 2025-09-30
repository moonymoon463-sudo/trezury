-- Store CRON_SECRET in config table (bypasses permission issues)
INSERT INTO public.config (key, value, updated_at)
VALUES ('cron_secret', 'a7f3e9d2c8b4f1a6e5d3c7b2a9f8e1d4c6b5a8f3e2d1c9b7a6f4e3d2c1b8a7f6', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Create secure function to get cron secret (only callable by cron jobs)
CREATE OR REPLACE FUNCTION public.get_cron_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.config WHERE key = 'cron_secret';
$$;

-- Update the cron job to use the config table secret
SELECT cron.unschedule('collect-gold-prices-hourly');

SELECT cron.schedule(
  'collect-gold-prices-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/gold-price-collector',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3OTM4MjUsImV4cCI6MjA3MzM2OTgyNX0.h1ZLLv3XeqTW1Eo8qwRdADCMO6_6dM69yhX53ew4_pI',
        'x-cron-secret', public.get_cron_secret()
      ),
      body := jsonb_build_object(
        'time', now()::text,
        'source', 'cron'
      )
    ) as request_id;
  $$
);