-- Phase 1: Database Optimization & Indexing for 10k users (fixed predicates)

-- Add strategic indexes for high-traffic queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
  ON transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status_type 
  ON transactions(status, type) WHERE status IN ('completed', 'pending');

CREATE INDEX IF NOT EXISTS idx_balance_snapshots_user_asset 
  ON balance_snapshots(user_id, asset, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_gold_prices_timestamp 
  ON gold_prices(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_quotes_user_expires 
  ON quotes(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_profiles_kyc_verified 
  ON profiles(kyc_status) WHERE kyc_status = 'verified';

CREATE INDEX IF NOT EXISTS idx_audit_log_user_timestamp 
  ON audit_log(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_status 
  ON payment_transactions(user_id, status, created_at DESC);

-- Add performance monitoring table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT DEFAULT 'count',
  recorded_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_name_time 
  ON performance_metrics(metric_name, recorded_at DESC);

-- Add system capacity tracking
CREATE TABLE IF NOT EXISTS system_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concurrent_users INTEGER DEFAULT 0,
  active_connections INTEGER DEFAULT 0,
  cpu_usage_percent NUMERIC DEFAULT 0,
  memory_usage_percent NUMERIC DEFAULT 0,
  response_time_ms NUMERIC DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_capacity_time 
  ON system_capacity(recorded_at DESC);

-- Function to record performance metrics
CREATE OR REPLACE FUNCTION record_performance_metric(
  p_metric_name text,
  p_metric_value numeric,
  p_metric_unit text DEFAULT 'count',
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, metadata)
  VALUES (p_metric_name, p_metric_value, p_metric_unit, p_metadata);
END;
$$;