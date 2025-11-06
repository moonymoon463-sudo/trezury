-- Add missing columns to bridge_transactions table
ALTER TABLE bridge_transactions
ADD COLUMN IF NOT EXISTS approval_tx_hash text,
ADD COLUMN IF NOT EXISTS gas_cost numeric,
ADD COLUMN IF NOT EXISTS error_message text;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bridge_transactions_status ON bridge_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bridge_transactions_user_created ON bridge_transactions(user_id, created_at DESC);

-- Add comment for documentation
COMMENT ON COLUMN bridge_transactions.approval_tx_hash IS 'Transaction hash for token approval (if required)';
COMMENT ON COLUMN bridge_transactions.gas_cost IS 'Actual gas cost in native token';
COMMENT ON COLUMN bridge_transactions.error_message IS 'Error message if bridge failed';