-- Unschedule legacy gold price collector if present
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gold-price-collection') THEN
    PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'gold-price-collection' LIMIT 1));
  END IF;
END $$;

-- Schedule XAUT price collector to run every minute
SELECT cron.schedule(
  'xaut-price-collection',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/xaut-price-collector',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3OTM4MjUsImV4cCI6MjA3MzM2OTgyNX0.h1ZLLv3XeqTW1Eo8qwRdADCMO6_6dM69yhX53ew4_pI"}'::jsonb,
    body := '{"cron": true}'::jsonb
  );
  $$
);

-- Ensure realtime works for gold_prices (so UI updates instantly)
ALTER TABLE public.gold_prices REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gold_prices;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
