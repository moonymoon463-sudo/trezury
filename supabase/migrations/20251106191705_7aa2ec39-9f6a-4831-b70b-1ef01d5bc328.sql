-- Create table for persistent historical candles
CREATE TABLE hyperliquid_historical_candles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market text NOT NULL,
  interval text NOT NULL,
  timestamp bigint NOT NULL,
  open text NOT NULL,
  high text NOT NULL,
  low text NOT NULL,
  close text NOT NULL,
  volume text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(market, interval, timestamp)
);

-- Create index for efficient querying
CREATE INDEX idx_candles_market_interval_time 
  ON hyperliquid_historical_candles(market, interval, timestamp DESC);

-- Enable RLS
ALTER TABLE hyperliquid_historical_candles ENABLE ROW LEVEL SECURITY;

-- Anyone can read historical candles (public market data)
CREATE POLICY "Anyone can view historical candles"
  ON hyperliquid_historical_candles
  FOR SELECT
  USING (true);

-- Service role can insert/update candles
CREATE POLICY "Service role can manage historical candles"
  ON hyperliquid_historical_candles
  FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Add historical depth tracking to chart settings
ALTER TABLE user_chart_settings 
ADD COLUMN IF NOT EXISTS earliest_loaded_time bigint,
ADD COLUMN IF NOT EXISTS total_candles_loaded integer DEFAULT 0;