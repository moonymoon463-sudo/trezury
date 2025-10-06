-- Add multi-wallet support to onchain_addresses
ALTER TABLE onchain_addresses ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
ALTER TABLE onchain_addresses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE onchain_addresses ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE onchain_addresses ADD COLUMN IF NOT EXISTS last_balance_check TIMESTAMPTZ;
ALTER TABLE onchain_addresses ADD COLUMN IF NOT EXISTS balance_snapshot NUMERIC;

-- Drop the old unique constraint on user_id only
ALTER TABLE onchain_addresses DROP CONSTRAINT IF EXISTS onchain_addresses_user_id_key;

-- Add unique constraint on (user_id, address) to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS onchain_addresses_user_address_unique 
ON onchain_addresses(user_id, address);

-- Add check constraint for archived status
ALTER TABLE onchain_addresses 
DROP CONSTRAINT IF EXISTS onchain_addresses_archived_check;

ALTER TABLE onchain_addresses 
ADD CONSTRAINT onchain_addresses_archived_check 
CHECK (
  (status = 'archived' AND archived_at IS NOT NULL) OR 
  (status != 'archived')
);

-- Create wallet change audit table
CREATE TABLE IF NOT EXISTS wallet_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  old_address TEXT,
  new_address TEXT,
  change_type TEXT NOT NULL,
  had_balance BOOLEAN DEFAULT false,
  balance_at_change NUMERIC,
  user_confirmed BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on wallet_change_audit
ALTER TABLE wallet_change_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own audit logs
CREATE POLICY "Users can view own wallet audit logs"
ON wallet_change_audit FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Service role can insert audit logs
CREATE POLICY "Service role can insert wallet audit logs"
ON wallet_change_audit FOR INSERT
TO service_role
WITH CHECK (true);

-- Create wallet balance alerts table
CREATE TABLE IF NOT EXISTS wallet_balance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  wallet_address TEXT NOT NULL,
  previous_balance NUMERIC,
  current_balance NUMERIC,
  balance_change NUMERIC,
  alert_reason TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on wallet_balance_alerts
ALTER TABLE wallet_balance_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own balance alerts
CREATE POLICY "Users can view own balance alerts"
ON wallet_balance_alerts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Service role can manage balance alerts
CREATE POLICY "Service role can manage balance alerts"
ON wallet_balance_alerts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Trigger to prevent wallet deletion
CREATE OR REPLACE FUNCTION prevent_wallet_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Wallets cannot be deleted, only archived. Use status=archived instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_onchain_addresses_delete ON onchain_addresses;
CREATE TRIGGER prevent_onchain_addresses_delete
BEFORE DELETE ON onchain_addresses
FOR EACH ROW EXECUTE FUNCTION prevent_wallet_deletion();

-- Trigger to log all wallet changes
CREATE OR REPLACE FUNCTION log_wallet_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO wallet_change_audit (user_id, new_address, change_type)
    VALUES (NEW.user_id, NEW.address, 'created');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO wallet_change_audit (
      user_id, old_address, new_address, change_type, 
      metadata
    ) VALUES (
      NEW.user_id, OLD.address, NEW.address, 
      NEW.status, 
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_onchain_addresses_changes ON onchain_addresses;
CREATE TRIGGER log_onchain_addresses_changes
AFTER INSERT OR UPDATE ON onchain_addresses
FOR EACH ROW EXECUTE FUNCTION log_wallet_changes();