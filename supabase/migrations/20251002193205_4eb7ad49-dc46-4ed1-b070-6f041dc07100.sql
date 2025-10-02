-- Add wallet setup tracking columns
ALTER TABLE onchain_addresses 
ADD COLUMN IF NOT EXISTS created_with_password BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS setup_method TEXT DEFAULT 'account_password';

-- Create wallet security events table for audit logging
CREATE TABLE IF NOT EXISTS wallet_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on wallet_security_events
ALTER TABLE wallet_security_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallet security events
CREATE POLICY "Users can view own wallet security events"
ON wallet_security_events
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert wallet security events
CREATE POLICY "Service role can insert wallet security events"
ON wallet_security_events
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Admins can view all wallet security events
CREATE POLICY "Admins can view all wallet security events"
ON wallet_security_events
FOR SELECT
USING (is_admin(auth.uid()));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_wallet_security_events_user_id ON wallet_security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_security_events_created_at ON wallet_security_events(created_at DESC);