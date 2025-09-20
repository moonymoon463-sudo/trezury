-- Fix security warnings from the enhanced PII protection migration

-- Fix function search path for enhanced_profile_security_audit function
CREATE OR REPLACE FUNCTION public.enhanced_profile_security_audit()
RETURNS TRIGGER AS $$
DECLARE
  sensitive_fields text[] := '{}';
  risk_level integer := 1;
BEGIN
  -- For UPDATE operations only
  IF TG_OP = 'UPDATE' THEN
    -- Check which sensitive fields are being modified
    IF NEW.ssn_last_four IS DISTINCT FROM OLD.ssn_last_four THEN
      sensitive_fields := array_append(sensitive_fields, 'ssn_last_four');
      risk_level := 5; -- High risk
    END IF;
    
    IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
      sensitive_fields := array_append(sensitive_fields, 'date_of_birth');
      risk_level := GREATEST(risk_level, 4);
    END IF;
    
    IF NEW.address IS DISTINCT FROM OLD.address THEN
      sensitive_fields := array_append(sensitive_fields, 'address');
      risk_level := GREATEST(risk_level, 3);
    END IF;
    
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN
      sensitive_fields := array_append(sensitive_fields, 'phone');
      risk_level := GREATEST(risk_level, 3);
    END IF;
    
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      sensitive_fields := array_append(sensitive_fields, 'email');
      risk_level := GREATEST(risk_level, 4);
    END IF;
    
    -- Log modifications to sensitive fields with risk assessment
    IF array_length(sensitive_fields, 1) > 0 THEN
      PERFORM log_high_risk_operation(
        'SENSITIVE_PII_UPDATE',
        'profiles',
        sensitive_fields,
        risk_level
      );
      
      -- Update encryption metadata
      NEW.encryption_metadata = jsonb_set(
        COALESCE(NEW.encryption_metadata, '{}'),
        '{last_modified}',
        to_jsonb(now())
      );
      
      NEW.encryption_metadata = jsonb_set(
        NEW.encryption_metadata,
        '{modified_fields}',
        to_jsonb(sensitive_fields)
      );
      
      -- Update last PII access timestamp
      NEW.last_pii_access = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix function search path for create_security_alert function
CREATE OR REPLACE FUNCTION public.create_security_alert(
  alert_type text,
  severity text DEFAULT 'medium',
  details jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log security event
  PERFORM log_security_event(
    alert_type,
    jsonb_build_object(
      'severity', severity,
      'details', details,
      'timestamp', now(),
      'user_id', auth.uid()
    )
  );
  
  -- Create notification for user if applicable
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, kind)
    VALUES (
      auth.uid(),
      'Security Alert: ' || alert_type,
      'A security event has been detected on your account. Please review your account activity.',
      'security_alert'
    );
  END IF;
END;
$$;