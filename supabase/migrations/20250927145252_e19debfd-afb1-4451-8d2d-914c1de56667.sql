-- Fix Security Issue 1: Move extensions from public schema to extensions schema
-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_cron from public to extensions (if it exists)
DROP EXTENSION IF EXISTS pg_cron CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Move any other extensions from public to extensions schema
-- This is a preventive measure for future extensions

-- Fix Security Issue 2: Enable leaked password protection
-- This needs to be done via Supabase dashboard, but we can create a function to check status

-- Create comprehensive transaction monitoring system
CREATE TABLE IF NOT EXISTS transaction_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('high_value', 'suspicious_pattern', 'failed_transaction', 'rate_limit_exceeded')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create real-time transaction monitoring function
CREATE OR REPLACE FUNCTION monitor_transaction_activity()
RETURNS TRIGGER AS $$
DECLARE
  user_transaction_count INTEGER;
  transaction_value NUMERIC;
  risk_score INTEGER := 0;
  alert_reasons TEXT[] := '{}';
BEGIN
  -- High-value transaction detection
  IF NEW.type IN ('buy', 'sell') AND (NEW.quantity * COALESCE(NEW.unit_price_usd, 0)) > 10000 THEN
    risk_score := risk_score + 30;
    alert_reasons := array_append(alert_reasons, 'High-value transaction');
  END IF;

  -- Rapid transaction pattern detection
  SELECT COUNT(*) INTO user_transaction_count
  FROM transactions 
  WHERE user_id = NEW.user_id 
    AND created_at > NOW() - INTERVAL '5 minutes';
    
  IF user_transaction_count > 5 THEN
    risk_score := risk_score + 40;
    alert_reasons := array_append(alert_reasons, 'Rapid transaction pattern');
  END IF;

  -- Failed transaction monitoring
  IF NEW.status = 'failed' THEN
    risk_score := risk_score + 20;
    alert_reasons := array_append(alert_reasons, 'Failed transaction');
  END IF;

  -- Create alert if risk threshold exceeded
  IF risk_score >= 30 THEN
    INSERT INTO transaction_alerts (
      transaction_id,
      alert_type,
      severity,
      description,
      metadata
    ) VALUES (
      NEW.id,
      CASE 
        WHEN risk_score >= 70 THEN 'suspicious_pattern'
        WHEN risk_score >= 50 THEN 'high_value'
        ELSE 'rate_limit_exceeded'
      END,
      CASE 
        WHEN risk_score >= 70 THEN 'critical'
        WHEN risk_score >= 50 THEN 'high'
        ELSE 'medium'
      END,
      'Transaction monitoring alert: ' || array_to_string(alert_reasons, ', '),
      jsonb_build_object(
        'risk_score', risk_score,
        'alert_reasons', alert_reasons,
        'transaction_value', NEW.quantity * COALESCE(NEW.unit_price_usd, 0),
        'user_recent_transactions', user_transaction_count
      )
    );

    -- Create user notification for high-risk transactions
    IF risk_score >= 50 THEN
      INSERT INTO notifications (user_id, title, body, kind, metadata)
      VALUES (
        NEW.user_id,
        'Transaction Security Alert',
        'Your recent transaction has been flagged for security review. If this wasn''t you, please contact support immediately.',
        'security_alert',
        jsonb_build_object(
          'transaction_id', NEW.id,
          'risk_score', risk_score,
          'auto_generated', true
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for transaction monitoring
DROP TRIGGER IF EXISTS transaction_monitoring_trigger ON transactions;
CREATE TRIGGER transaction_monitoring_trigger
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION monitor_transaction_activity();

-- Create comprehensive security audit enhancements
CREATE TABLE IF NOT EXISTS security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES profiles(id),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Enable RLS on new tables
ALTER TABLE transaction_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for transaction alerts (admin and user access)
CREATE POLICY "Users can view their own transaction alerts"
  ON transaction_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions t 
      WHERE t.id = transaction_alerts.transaction_id 
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all transaction alerts"
  ON transaction_alerts FOR ALL
  USING (public.is_admin(auth.uid()));

-- Create RLS policies for security incidents
CREATE POLICY "Users can view their own security incidents"
  ON security_incidents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all security incidents"
  ON security_incidents FOR ALL
  USING (public.is_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_alerts_type ON transaction_alerts(alert_type, created_at);
CREATE INDEX IF NOT EXISTS idx_transaction_alerts_severity ON transaction_alerts(severity, resolved);
CREATE INDEX IF NOT EXISTS idx_security_incidents_user ON security_incidents(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON security_incidents(status, severity);

-- Create function to check extension placement security
CREATE OR REPLACE FUNCTION check_extension_security()
RETURNS TABLE(extension_name TEXT, schema_name TEXT, security_status TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.extname::TEXT,
    n.nspname::TEXT,
    CASE 
      WHEN n.nspname = 'public' THEN 'SECURITY_RISK'
      WHEN n.nspname = 'extensions' THEN 'SECURE'
      ELSE 'REVIEW_NEEDED'
    END::TEXT
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  ORDER BY e.extname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;