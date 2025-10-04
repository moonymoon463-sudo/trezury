-- ===================================================================
-- Phase 3: Wallet Key Security - Add setup method tracking
-- ===================================================================

-- Add column to track wallet encryption method for migration purposes
ALTER TABLE encrypted_wallet_keys 
ADD COLUMN IF NOT EXISTS encryption_method text DEFAULT 'password_based';

-- Add column to track when wallet was created
ALTER TABLE encrypted_wallet_keys
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Create index for looking up by encryption method
CREATE INDEX IF NOT EXISTS idx_encrypted_wallet_keys_encryption_method
ON encrypted_wallet_keys(encryption_method);

-- Update existing wallets to mark them as legacy (userId encrypted)
UPDATE encrypted_wallet_keys
SET encryption_method = 'legacy_userid'
WHERE encryption_method = 'password_based'
  AND created_at < now();

-- Add comment
COMMENT ON COLUMN encrypted_wallet_keys.encryption_method IS 
  'Tracks encryption method: legacy_userid (insecure), password_based (secure), or kms (future)';