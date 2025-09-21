-- Phase 2: Core Business Logic - Liquidation System Infrastructure

-- Create liquidation thresholds table for dynamic risk management
CREATE TABLE IF NOT EXISTS liquidation_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  chain text NOT NULL DEFAULT 'ethereum',
  health_factor_threshold numeric NOT NULL DEFAULT 1.0,
  liquidation_bonus numeric NOT NULL DEFAULT 0.05,
  max_liquidation_ratio numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset, chain)
);

-- Enable RLS
ALTER TABLE liquidation_thresholds ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Liquidation thresholds are publicly viewable" 
ON liquidation_thresholds FOR SELECT 
USING (true);

-- Create policy for service role updates
CREATE POLICY "Service role can manage liquidation thresholds" 
ON liquidation_thresholds FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Populate with initial liquidation thresholds
INSERT INTO liquidation_thresholds (asset, chain, health_factor_threshold, liquidation_bonus, max_liquidation_ratio) VALUES
('USDC', 'ethereum', 1.0, 0.05, 0.5),
('USDT', 'ethereum', 1.0, 0.05, 0.5),
('DAI', 'ethereum', 1.0, 0.05, 0.5),
('XAUT', 'ethereum', 1.15, 0.10, 0.4),
('AURU', 'ethereum', 1.25, 0.15, 0.3),
('USDC', 'base', 1.0, 0.05, 0.5),
('USDT', 'base', 1.0, 0.05, 0.5)
ON CONFLICT (asset, chain) DO UPDATE SET
  health_factor_threshold = EXCLUDED.health_factor_threshold,
  liquidation_bonus = EXCLUDED.liquidation_bonus,
  max_liquidation_ratio = EXCLUDED.max_liquidation_ratio,
  updated_at = now();

-- Create risk alerts table for proactive risk management
CREATE TABLE IF NOT EXISTS risk_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_type text NOT NULL, -- 'health_factor_warning', 'liquidation_risk', 'position_limit'
  severity text NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for risk alerts
CREATE POLICY "Users can view their own risk alerts" 
ON risk_alerts FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can acknowledge their own risk alerts" 
ON risk_alerts FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can create risk alerts" 
ON risk_alerts FOR INSERT 
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Create position limits table for enhanced risk management
CREATE TABLE IF NOT EXISTS position_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset text NOT NULL,
  chain text NOT NULL DEFAULT 'ethereum',
  max_supply_amount numeric NOT NULL DEFAULT 0,
  max_borrow_amount numeric NOT NULL DEFAULT 0,
  risk_tier text NOT NULL DEFAULT 'standard', -- 'conservative', 'standard', 'aggressive'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset, chain)
);

-- Enable RLS
ALTER TABLE position_limits ENABLE ROW LEVEL SECURITY;

-- Create policies for position limits
CREATE POLICY "Users can manage their own position limits" 
ON position_limits FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to check liquidation eligibility
CREATE OR REPLACE FUNCTION check_liquidation_eligibility(target_user_id uuid, target_chain text DEFAULT 'ethereum')
RETURNS TABLE(
  user_id uuid,
  health_factor numeric,
  total_debt_usd numeric,
  total_collateral_usd numeric,
  liquidatable boolean,
  liquidation_bonus numeric,
  max_liquidation_amount numeric
) AS $$
DECLARE
  user_health_record RECORD;
  threshold_record RECORD;
BEGIN
  -- Get user's current health factor
  SELECT * INTO user_health_record
  FROM user_health_factors uhf
  WHERE uhf.user_id = target_user_id 
    AND uhf.chain = target_chain;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Check if user is eligible for liquidation (health factor < 1.0)
  IF user_health_record.health_factor >= 1.0 THEN
    RETURN QUERY SELECT
      target_user_id,
      user_health_record.health_factor,
      user_health_record.total_debt_usd,
      user_health_record.total_collateral_usd,
      false::boolean,
      0::numeric,
      0::numeric;
    RETURN;
  END IF;
  
  -- Get liquidation parameters (use average if multiple assets)
  SELECT 
    AVG(liquidation_bonus) as avg_bonus,
    AVG(max_liquidation_ratio) as avg_max_ratio
  INTO threshold_record
  FROM liquidation_thresholds
  WHERE chain = target_chain;
  
  -- Return liquidation details
  RETURN QUERY SELECT
    target_user_id,
    user_health_record.health_factor,
    user_health_record.total_debt_usd,
    user_health_record.total_collateral_usd,
    true::boolean,
    COALESCE(threshold_record.avg_bonus, 0.05),
    COALESCE(user_health_record.total_debt_usd * COALESCE(threshold_record.avg_max_ratio, 0.5), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to generate risk alerts
CREATE OR REPLACE FUNCTION generate_risk_alerts()
RETURNS void AS $$
DECLARE
  user_health_record RECORD;
  alert_message text;
BEGIN
  -- Check all users with health factors between 1.0 and 1.2 for warnings
  FOR user_health_record IN 
    SELECT * FROM user_health_factors 
    WHERE health_factor BETWEEN 1.0 AND 1.2
    AND last_calculated_at > now() - INTERVAL '1 hour'
  LOOP
    -- Generate appropriate alert message
    IF user_health_record.health_factor < 1.05 THEN
      alert_message := 'CRITICAL: Your health factor is ' || ROUND(user_health_record.health_factor, 3) || '. Immediate action required to avoid liquidation.';
      
      INSERT INTO risk_alerts (user_id, alert_type, severity, message, metadata)
      VALUES (
        user_health_record.user_id,
        'liquidation_risk',
        'critical',
        alert_message,
        jsonb_build_object(
          'health_factor', user_health_record.health_factor,
          'chain', user_health_record.chain,
          'total_debt', user_health_record.total_debt_usd,
          'total_collateral', user_health_record.total_collateral_usd
        )
      )
      ON CONFLICT DO NOTHING;
      
    ELSIF user_health_record.health_factor < 1.15 THEN
      alert_message := 'WARNING: Your health factor is ' || ROUND(user_health_record.health_factor, 3) || '. Consider reducing your borrow positions.';
      
      INSERT INTO risk_alerts (user_id, alert_type, severity, message, metadata)
      VALUES (
        user_health_record.user_id,
        'health_factor_warning',
        'high',
        alert_message,
        jsonb_build_object(
          'health_factor', user_health_record.health_factor,
          'chain', user_health_record.chain,
          'total_debt', user_health_record.total_debt_usd,
          'total_collateral', user_health_record.total_collateral_usd
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to generate alerts when health factors are updated
CREATE OR REPLACE FUNCTION trigger_risk_alert_generation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate alerts for significant health factor changes
  IF NEW.health_factor < 1.2 AND 
     (OLD.health_factor IS NULL OR ABS(NEW.health_factor - OLD.health_factor) > 0.05) THEN
    PERFORM generate_risk_alerts();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger on user_health_factors
DROP TRIGGER IF EXISTS generate_risk_alerts_trigger ON user_health_factors;
CREATE TRIGGER generate_risk_alerts_trigger
  AFTER INSERT OR UPDATE ON user_health_factors
  FOR EACH ROW EXECUTE FUNCTION trigger_risk_alert_generation();

-- Add real-time subscriptions to critical tables
ALTER TABLE liquidation_calls REPLICA IDENTITY FULL;
ALTER TABLE risk_alerts REPLICA IDENTITY FULL;
ALTER TABLE position_limits REPLICA IDENTITY FULL;

-- Add tables to real-time publication
ALTER PUBLICATION supabase_realtime ADD TABLE liquidation_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE risk_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE position_limits;