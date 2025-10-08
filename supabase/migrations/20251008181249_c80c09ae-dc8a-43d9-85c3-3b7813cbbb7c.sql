-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule gold price collection every hour
SELECT cron.schedule(
  'gold-price-hourly-collection',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/gold-price-collector',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnRrdmxsemVqdGZxbW91c3hnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc5MzgyNSwiZXhwIjoyMDczMzY5ODI1fQ.3OxYTEk6kXC5RgfHN8VL9YN3p3Dl3HF-GXFRNcT1Ql4"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- Create a function to check for stale gold prices and alert
CREATE OR REPLACE FUNCTION check_stale_gold_price()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  latest_price_age INTERVAL;
BEGIN
  -- Get age of most recent gold price
  SELECT NOW() - MAX(timestamp) INTO latest_price_age
  FROM gold_prices;
  
  -- Alert if price is more than 2 hours old
  IF latest_price_age > INTERVAL '2 hours' THEN
    INSERT INTO security_alerts (
      alert_type,
      severity,
      title,
      description,
      metadata
    ) VALUES (
      'stale_gold_price',
      'medium',
      'Stale Gold Price Data',
      'Gold price data has not been updated in over 2 hours',
      jsonb_build_object(
        'age_hours', EXTRACT(EPOCH FROM latest_price_age) / 3600,
        'last_update', (SELECT MAX(timestamp) FROM gold_prices)
      )
    );
  END IF;
END;
$$;

-- Schedule stale price check every 30 minutes
SELECT cron.schedule(
  'gold-price-staleness-check',
  '*/30 * * * *', -- Every 30 minutes
  $$
  SELECT check_stale_gold_price();
  $$
);