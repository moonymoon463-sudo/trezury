-- Add Alchemy address tracking to profiles and snx_accounts
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alchemy_address TEXT;
ALTER TABLE snx_accounts ADD COLUMN IF NOT EXISTS alchemy_address TEXT;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_alchemy_address ON profiles(alchemy_address);
CREATE INDEX IF NOT EXISTS idx_snx_accounts_alchemy_address ON snx_accounts(alchemy_address);

-- Add comment for documentation
COMMENT ON COLUMN profiles.alchemy_address IS 'Alchemy Account Kit smart wallet address on Base network';
COMMENT ON COLUMN snx_accounts.alchemy_address IS 'Alchemy wallet address used to create this Synthetix account';