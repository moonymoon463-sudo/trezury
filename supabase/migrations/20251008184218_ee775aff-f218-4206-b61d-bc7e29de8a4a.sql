-- Remove source validation constraint so XAUT prices can be stored
-- Check if constraint exists and drop it
DO $$ 
BEGIN
    -- Remove any check constraint on source column
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%source%' 
        AND table_name = 'gold_prices'
        AND constraint_type = 'CHECK'
    ) THEN
        ALTER TABLE gold_prices DROP CONSTRAINT IF EXISTS gold_prices_source_check;
    END IF;
    
    -- Also check for trigger-based validation
    DROP TRIGGER IF EXISTS validate_gold_price_source ON gold_prices;
    DROP FUNCTION IF EXISTS validate_gold_price_source();
END $$;

-- Allow any source for gold prices
-- This enables XAUT composite pricing from multiple crypto exchanges
COMMENT ON COLUMN gold_prices.source IS 'Source of gold price data - supports traditional sources (yahoo_finance, alpha_vantage) and crypto sources (xaut_composite, coingecko, cryptocompare)';