-- Fix api_rate_limits duplicate key violations with UPSERT pattern
-- This migration adds a unique constraint and updates the rate limiting logic

-- First, remove any duplicate entries (keep the latest)
DELETE FROM api_rate_limits a
USING api_rate_limits b
WHERE a.id < b.id
  AND a.identifier = b.identifier
  AND a.endpoint = b.endpoint;

-- Add unique constraint to prevent future duplicates
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'api_rate_limits_identifier_endpoint_key'
  ) THEN
    ALTER TABLE api_rate_limits
    ADD CONSTRAINT api_rate_limits_identifier_endpoint_key 
    UNIQUE (identifier, endpoint);
  END IF;
END $$;

-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window_start 
ON api_rate_limits(window_start);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_blocked_until 
ON api_rate_limits(blocked_until) 
WHERE blocked_until IS NOT NULL;

-- Add indexes for transactions table (from performance audit)
CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
ON transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status_type 
ON transactions(status, type) 
WHERE status = 'completed';

-- Add indexes for gold_prices table
CREATE INDEX IF NOT EXISTS idx_gold_prices_source_timestamp 
ON gold_prices(source, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_gold_prices_timestamp_desc 
ON gold_prices(timestamp DESC);