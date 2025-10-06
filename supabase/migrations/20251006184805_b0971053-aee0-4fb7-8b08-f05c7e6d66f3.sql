-- Priority 3: Fee Improvements - Create fee reconciliation tracking table

-- Create fee reconciliation log table
CREATE TABLE IF NOT EXISTS fee_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  quote_id UUID REFERENCES quotes(id),
  
  -- Gas fee tracking
  estimated_gas_cost NUMERIC NOT NULL,
  actual_gas_cost NUMERIC NOT NULL,
  gas_difference NUMERIC GENERATED ALWAYS AS (actual_gas_cost - estimated_gas_cost) STORED,
  gas_price_gwei NUMERIC,
  gas_used BIGINT,
  
  -- Platform fee tracking
  platform_fee_bps INTEGER NOT NULL DEFAULT 80,
  platform_fee_amount NUMERIC NOT NULL,
  platform_fee_asset TEXT NOT NULL,
  
  -- Relay fee tracking
  relay_fee_usd NUMERIC NOT NULL,
  relay_fee_asset TEXT NOT NULL,
  relay_fee_amount NUMERIC NOT NULL,
  relay_margin NUMERIC NOT NULL DEFAULT 1.5,
  
  -- Total tracking
  total_fees_charged NUMERIC NOT NULL,
  output_asset TEXT NOT NULL,
  output_amount_gross NUMERIC NOT NULL,
  output_amount_net NUMERIC NOT NULL,
  
  -- Threshold tracking
  exceeded_margin BOOLEAN GENERATED ALWAYS AS (
    actual_gas_cost > (estimated_gas_cost * 1.5)
  ) STORED,
  
  -- Metadata
  swap_protocol TEXT,
  chain TEXT DEFAULT 'ethereum',
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE fee_reconciliation_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own fee logs
CREATE POLICY "Users view own fee logs"
ON fee_reconciliation_log FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert fee logs
CREATE POLICY "Service role manages fee logs"
ON fee_reconciliation_log FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Admins can view all fee logs
CREATE POLICY "Admins view all fee logs"
ON fee_reconciliation_log FOR SELECT
USING (is_admin(auth.uid()));

-- Create index for performance
CREATE INDEX idx_fee_reconciliation_user ON fee_reconciliation_log(user_id, created_at DESC);
CREATE INDEX idx_fee_reconciliation_exceeded ON fee_reconciliation_log(exceeded_margin, created_at DESC) WHERE exceeded_margin = true;
CREATE INDEX idx_fee_reconciliation_transaction ON fee_reconciliation_log(transaction_id);

-- Create function to create fee margin exceeded alert
CREATE OR REPLACE FUNCTION create_fee_margin_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- If gas cost exceeded 1.5x margin, create alert
  IF NEW.exceeded_margin THEN
    -- Create reconciliation alert for balance mismatch
    INSERT INTO balance_reconciliations (
      user_id,
      address,
      asset,
      db_balance,
      chain_balance,
      difference,
      status,
      metadata
    ) VALUES (
      NEW.user_id,
      'fee_reconciliation',
      NEW.output_asset,
      NEW.estimated_gas_cost,
      NEW.actual_gas_cost,
      NEW.gas_difference,
      'under_review',
      jsonb_build_object(
        'alert_type', 'fee_margin_exceeded',
        'severity', 'high',
        'fee_log_id', NEW.id,
        'transaction_id', NEW.transaction_id,
        'estimated_gas_usd', NEW.estimated_gas_cost,
        'actual_gas_usd', NEW.actual_gas_cost,
        'difference_usd', NEW.gas_difference,
        'percentage_over', ((NEW.actual_gas_cost / NEW.estimated_gas_cost - 1) * 100)::numeric(10,2),
        'relay_margin_used', NEW.relay_margin,
        'recommendation', 'Review gas pricing or increase relay margin',
        'timestamp', NOW()
      )
    );
    
    -- Also log to audit trail
    INSERT INTO audit_log (
      user_id,
      table_name,
      operation,
      metadata
    ) VALUES (
      NEW.user_id,
      'fee_reconciliation_log',
      'FEE_MARGIN_EXCEEDED',
      jsonb_build_object(
        'fee_log_id', NEW.id,
        'gas_overage_usd', NEW.gas_difference,
        'percentage_over', ((NEW.actual_gas_cost / NEW.estimated_gas_cost - 1) * 100)::numeric(10,2)
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for fee margin alerts
CREATE TRIGGER fee_margin_alert_trigger
  AFTER INSERT ON fee_reconciliation_log
  FOR EACH ROW
  EXECUTE FUNCTION create_fee_margin_alert();

-- Create view for fee analytics
CREATE OR REPLACE VIEW fee_analytics_summary AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  output_asset,
  COUNT(*) as swap_count,
  SUM(total_fees_charged) as total_fees,
  AVG(platform_fee_amount) as avg_platform_fee,
  AVG(relay_fee_amount) as avg_relay_fee,
  SUM(CASE WHEN exceeded_margin THEN 1 ELSE 0 END) as margin_exceeded_count,
  AVG(gas_difference) as avg_gas_difference,
  MAX(gas_difference) as max_gas_overage
FROM fee_reconciliation_log
GROUP BY DATE_TRUNC('day', created_at), output_asset
ORDER BY date DESC;

-- Set view as security invoker to respect RLS
ALTER VIEW fee_analytics_summary SET (security_invoker = on);

-- Grant access
GRANT SELECT ON fee_analytics_summary TO authenticated;

-- Create function for admins to get fee reconciliation summary
CREATE OR REPLACE FUNCTION get_fee_reconciliation_summary(days_back INTEGER DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check admin access
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  SELECT json_build_object(
    'period_days', days_back,
    'total_swaps', COUNT(*),
    'total_fees_collected_usd', SUM(total_fees_charged),
    'total_platform_fees_usd', SUM(platform_fee_amount),
    'total_relay_fees_usd', SUM(relay_fee_usd),
    'avg_fee_per_swap_usd', AVG(total_fees_charged),
    'margin_exceeded_count', SUM(CASE WHEN exceeded_margin THEN 1 ELSE 0 END),
    'margin_exceeded_percentage', 
      ROUND((SUM(CASE WHEN exceeded_margin THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)) * 100, 2),
    'total_gas_overage_usd', SUM(CASE WHEN exceeded_margin THEN gas_difference ELSE 0 END),
    'max_single_overage_usd', MAX(gas_difference),
    'asset_breakdown', (
      SELECT json_object_agg(
        output_asset,
        json_build_object(
          'count', COUNT(*),
          'total_fees', SUM(total_fees_charged),
          'margin_exceeded', SUM(CASE WHEN exceeded_margin THEN 1 ELSE 0 END)
        )
      )
      FROM fee_reconciliation_log
      WHERE created_at > NOW() - (days_back || ' days')::INTERVAL
      GROUP BY output_asset
    )
  ) INTO result
  FROM fee_reconciliation_log
  WHERE created_at > NOW() - (days_back || ' days')::INTERVAL;
  
  RETURN result;
END;
$$;