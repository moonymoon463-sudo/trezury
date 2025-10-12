-- Add chain column to transactions table
ALTER TABLE transactions 
ADD COLUMN chain TEXT DEFAULT 'ethereum' CHECK (chain IN ('ethereum', 'arbitrum', 'base'));

-- Add chain column to payment_transactions table
ALTER TABLE payment_transactions 
ADD COLUMN chain TEXT DEFAULT 'ethereum';

-- Create indices for better query performance
CREATE INDEX idx_transactions_chain ON transactions(chain);
CREATE INDEX idx_transactions_user_chain ON transactions(user_id, chain);
CREATE INDEX idx_transactions_user_asset_chain ON transactions(user_id, asset, chain);

-- Backfill existing transactions with chain information
-- Infer from asset suffix (_ARB) or metadata
UPDATE transactions
SET chain = CASE
  WHEN metadata->>'chain' = 'arbitrum' THEN 'arbitrum'
  WHEN metadata->>'chain' = 'base' THEN 'base'
  WHEN asset LIKE '%_ARB' THEN 'arbitrum'
  ELSE 'ethereum'
END
WHERE chain IS NULL OR chain = 'ethereum';

-- Normalize asset names - remove _ARB suffix as chain is now in separate column
UPDATE transactions
SET 
  asset = REPLACE(asset, '_ARB', ''),
  chain = 'arbitrum'
WHERE asset LIKE '%_ARB';

UPDATE transactions
SET 
  input_asset = REPLACE(input_asset, '_ARB', ''),
  output_asset = REPLACE(output_asset, '_ARB', '')
WHERE input_asset LIKE '%_ARB' OR output_asset LIKE '%_ARB';