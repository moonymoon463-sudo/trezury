-- Add comprehensive audit triggers for transaction security
-- This ensures all transaction access is logged for security monitoring

-- Create enhanced transaction monitoring trigger
CREATE OR REPLACE FUNCTION public.enhanced_transaction_security_audit()
RETURNS TRIGGER AS $$
DECLARE
  sensitive_fields text[] := '{}';
  risk_level integer := 1;
BEGIN
  -- For INSERT operations - log new transaction creation
  IF TG_OP = 'INSERT' THEN
    -- High-value transaction detection
    IF NEW.type IN ('buy', 'sell') AND (NEW.quantity * COALESCE(NEW.unit_price_usd, 0)) > 10000 THEN
      risk_level := 5;
      sensitive_fields := array_append(sensitive_fields, 'high_value_transaction');
    END IF;
    
    -- Log transaction creation
    PERFORM log_high_risk_operation(
      'TRANSACTION_CREATE',
      'transactions',
      ARRAY['amount', 'asset', 'type'],
      risk_level
    );
  END IF;
  
  -- For UPDATE operations - track modifications to sensitive financial data
  IF TG_OP = 'UPDATE' THEN
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      sensitive_fields := array_append(sensitive_fields, 'quantity');
      risk_level := GREATEST(risk_level, 4);
    END IF;
    
    IF NEW.unit_price_usd IS DISTINCT FROM OLD.unit_price_usd THEN
      sensitive_fields := array_append(sensitive_fields, 'unit_price_usd');
      risk_level := GREATEST(risk_level, 4);
    END IF;
    
    IF NEW.fee_usd IS DISTINCT FROM OLD.fee_usd THEN
      sensitive_fields := array_append(sensitive_fields, 'fee_usd');
      risk_level := GREATEST(risk_level, 3);
    END IF;
    
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      sensitive_fields := array_append(sensitive_fields, 'status');
      risk_level := GREATEST(risk_level, 2);
    END IF;
    
    -- Log modifications to sensitive transaction fields
    IF array_length(sensitive_fields, 1) > 0 THEN
      PERFORM log_high_risk_operation(
        'TRANSACTION_MODIFY',
        'transactions',
        sensitive_fields,
        risk_level
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply the enhanced security audit trigger to transactions table
DROP TRIGGER IF EXISTS enhanced_transaction_security_audit_trigger ON public.transactions;
CREATE TRIGGER enhanced_transaction_security_audit_trigger
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.enhanced_transaction_security_audit();

-- Add transaction monitoring trigger that's already defined but ensure it's active
DROP TRIGGER IF EXISTS monitor_transaction_activity_trigger ON public.transactions;
CREATE TRIGGER monitor_transaction_activity_trigger
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.monitor_transaction_activity();

-- Create additional security policy to prevent data exposure through metadata
CREATE POLICY "Prevent metadata exploitation" 
ON public.transactions 
FOR SELECT 
USING (
  auth.uid() = user_id 
  AND (
    -- Ensure user can only see their own transaction metadata
    metadata IS NULL 
    OR NOT (metadata ? 'admin_notes')
    OR NOT (metadata ? 'internal_reference')
  )
);

-- Add rate limiting policy for transaction access to prevent scraping
CREATE OR REPLACE FUNCTION public.check_transaction_access_rate_limit()
RETURNS BOOLEAN AS $$
DECLARE
  recent_access_count INTEGER;
BEGIN
  -- Count recent transaction accesses by this user
  SELECT COUNT(*) INTO recent_access_count
  FROM audit_log 
  WHERE user_id = auth.uid()
    AND table_name = 'transactions'
    AND operation IN ('SELECT', 'TRANSACTION_ACCESS')
    AND timestamp > (NOW() - INTERVAL '1 minute');
  
  -- Allow up to 50 transaction accesses per minute per user
  RETURN recent_access_count < 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply rate limiting to transaction access
CREATE POLICY "Rate limit transaction access" 
ON public.transactions 
FOR SELECT 
USING (
  auth.uid() = user_id 
  AND check_transaction_access_rate_limit()
);

-- Create emergency transaction lockdown function for security incidents
CREATE OR REPLACE FUNCTION public.emergency_transaction_lockdown()
RETURNS BOOLEAN AS $$
DECLARE
  lockdown_active BOOLEAN := FALSE;
BEGIN
  -- Check if emergency lockdown is active
  SELECT (config_value->>'enabled')::BOOLEAN INTO lockdown_active
  FROM security_config 
  WHERE config_key = 'emergency_transaction_lockdown';
  
  RETURN NOT COALESCE(lockdown_active, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add emergency lockdown policy
CREATE POLICY "Emergency transaction lockdown" 
ON public.transactions 
FOR ALL
USING (emergency_transaction_lockdown());

-- Insert initial security configuration
INSERT INTO security_config (config_key, config_value, created_by)
VALUES (
  'emergency_transaction_lockdown',
  '{"enabled": false, "reason": "", "activated_at": null}',
  auth.uid()
) ON CONFLICT (config_key) DO NOTHING;