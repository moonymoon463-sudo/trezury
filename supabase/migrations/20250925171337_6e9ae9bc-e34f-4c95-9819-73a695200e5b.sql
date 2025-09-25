-- One-time data hygiene: remove obvious outliers and add index
DELETE FROM public.gold_prices WHERE usd_per_oz > 5000 OR usd_per_oz < 500;

-- Helpful index for latest price lookups
CREATE INDEX IF NOT EXISTS idx_gold_prices_timestamp ON public.gold_prices (timestamp DESC);