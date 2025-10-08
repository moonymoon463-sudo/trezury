-- Fix search path and force trigger reload
DROP TRIGGER IF EXISTS validate_gold_price_before_insert ON gold_prices;
DROP FUNCTION IF EXISTS validate_gold_price_insert();

-- Recreate with proper search_path
CREATE OR REPLACE FUNCTION validate_gold_price_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow approved sources: traditional + crypto exchanges
  IF NEW.source NOT IN (
    'yahoo_finance',
    'alpha_vantage', 
    'metals_api',
    'tradingview',
    'google_finance',
    'xaut_composite',
    'coingecko',
    'cryptocompare',
    'coinbase'
  ) THEN
    RAISE EXCEPTION 'Invalid source: % is not an approved gold price source', NEW.source;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER validate_gold_price_before_insert
  BEFORE INSERT ON gold_prices
  FOR EACH ROW
  EXECUTE FUNCTION validate_gold_price_insert();