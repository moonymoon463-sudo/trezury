-- Create user chart settings table for persisting chart configuration
CREATE TABLE IF NOT EXISTS user_chart_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  market TEXT NOT NULL,
  resolution TEXT NOT NULL,
  indicators JSONB DEFAULT '[]'::jsonb,
  drawings JSONB DEFAULT '[]'::jsonb,
  viewport JSONB DEFAULT '{}'::jsonb,
  live_mode BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, market, resolution)
);

-- Create trade audit log table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS trade_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  market TEXT NOT NULL,
  order_details JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  result TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create market rules cache table
CREATE TABLE IF NOT EXISTS market_rules_cache (
  market TEXT PRIMARY KEY,
  tick_size DECIMAL NOT NULL,
  step_size DECIMAL NOT NULL,
  min_order_size DECIMAL NOT NULL,
  min_notional DECIMAL NOT NULL,
  max_leverage INTEGER NOT NULL DEFAULT 20,
  maker_fee_rate DECIMAL NOT NULL DEFAULT 0.0002,
  taker_fee_rate DECIMAL NOT NULL DEFAULT 0.0005,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_chart_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_rules_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_chart_settings
CREATE POLICY "Users can view own chart settings"
  ON user_chart_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chart settings"
  ON user_chart_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chart settings"
  ON user_chart_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chart settings"
  ON user_chart_settings FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for trade_audit_log
CREATE POLICY "Users can view own audit logs"
  ON trade_audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert audit logs"
  ON trade_audit_log FOR INSERT
  WITH CHECK (true);

-- RLS Policies for market_rules_cache (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view market rules"
  ON market_rules_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX idx_user_chart_settings_user_id ON user_chart_settings(user_id);
CREATE INDEX idx_user_chart_settings_market ON user_chart_settings(market);
CREATE INDEX idx_trade_audit_log_user_id ON trade_audit_log(user_id);
CREATE INDEX idx_trade_audit_log_created_at ON trade_audit_log(created_at DESC);
CREATE INDEX idx_trade_audit_log_market ON trade_audit_log(market);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_chart_settings
CREATE TRIGGER update_user_chart_settings_updated_at
  BEFORE UPDATE ON user_chart_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();