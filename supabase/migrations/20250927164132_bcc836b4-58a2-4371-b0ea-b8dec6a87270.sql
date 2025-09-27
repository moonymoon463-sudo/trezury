-- Create webhook processing log table for idempotency and monitoring
CREATE TABLE IF NOT EXISTS webhook_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL UNIQUE,
  webhook_type TEXT NOT NULL,
  external_id TEXT,
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'processing',
  processing_time_ms INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- RLS for webhook processing log
ALTER TABLE webhook_processing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage webhook logs" 
ON webhook_processing_log 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "Admins can view webhook logs" 
ON webhook_processing_log 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Rate limiting table for production webhook security
CREATE TABLE IF NOT EXISTS webhook_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL UNIQUE,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for rate limits (admin only)
ALTER TABLE webhook_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage webhook rate limits" 
ON webhook_rate_limits 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Enhanced database indexes for critical queries
CREATE INDEX IF NOT EXISTS idx_balance_snapshots_user_asset_time 
ON balance_snapshots(user_id, asset, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created_status 
ON transactions(user_id, created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status_created 
ON profiles(kyc_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_id 
ON payment_transactions(external_id);

CREATE INDEX IF NOT EXISTS idx_gold_prices_timestamp_source 
ON gold_prices(timestamp DESC, source);

CREATE INDEX IF NOT EXISTS idx_quotes_user_expires 
ON quotes(user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created 
ON notifications(user_id, read, created_at DESC);