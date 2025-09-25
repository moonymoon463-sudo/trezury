-- Create gold_prices table for storing historical price data
CREATE TABLE public.gold_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  usd_per_oz NUMERIC NOT NULL,
  usd_per_gram NUMERIC NOT NULL,
  change_24h NUMERIC,
  change_percent_24h NUMERIC,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(timestamp, source)
);

-- Create indexes for efficient querying
CREATE INDEX idx_gold_prices_timestamp ON public.gold_prices(timestamp DESC);
CREATE INDEX idx_gold_prices_source ON public.gold_prices(source);
CREATE INDEX idx_gold_prices_latest ON public.gold_prices(timestamp DESC, source);

-- Enable RLS
ALTER TABLE public.gold_prices ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (since this will be used by public API)
CREATE POLICY "Anyone can view gold prices" 
ON public.gold_prices 
FOR SELECT 
USING (true);

-- Create policy for service role to insert prices
CREATE POLICY "Service role can insert gold prices" 
ON public.gold_prices 
FOR INSERT 
WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- Function to get latest gold price
CREATE OR REPLACE FUNCTION public.get_latest_gold_price()
RETURNS TABLE(
  usd_per_oz NUMERIC,
  usd_per_gram NUMERIC,
  change_24h NUMERIC,
  change_percent_24h NUMERIC,
  last_updated TIMESTAMP WITH TIME ZONE,
  source TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    gp.usd_per_oz,
    gp.usd_per_gram,
    gp.change_24h,
    gp.change_percent_24h,
    gp.timestamp as last_updated,
    gp.source
  FROM gold_prices gp
  ORDER BY gp.timestamp DESC
  LIMIT 1;
END;
$function$;