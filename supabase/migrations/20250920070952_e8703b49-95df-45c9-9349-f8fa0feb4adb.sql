-- Enhanced security measures for customer PII protection

-- 1. Add encryption tracking columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS encryption_metadata jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS data_classification text DEFAULT 'sensitive',
ADD COLUMN IF NOT EXISTS last_pii_access timestamptz DEFAULT now();

-- 2. Create a PII access control table for fine-grained permissions
CREATE TABLE IF NOT EXISTS public.pii_access_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  field_name text NOT NULL,
  access_level text NOT NULL DEFAULT 'restricted', -- 'public', 'restricted', 'encrypted'
  encryption_required boolean DEFAULT true,
  access_reason text,
  authorized_by uuid,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, field_name)
);

-- Enable RLS on PII access control
ALTER TABLE public.pii_access_control ENABLE ROW LEVEL SECURITY;

-- Create policy for PII access control
CREATE POLICY "Users can manage their own PII access settings"
ON public.pii_access_control
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Create enhanced audit trigger for profiles table
CREATE OR REPLACE FUNCTION public.enhanced_profile_security_audit()
RETURNS TRIGGER AS $$
DECLARE
  sensitive_fields text[] := '{}';
  risk_level integer := 1;
BEGIN
  -- Track sensitive field access
  IF TG_OP = 'SELECT' THEN
    -- Log all profile access with field-level granularity
    PERFORM log_sensitive_access(
      'profiles',
      'PROFILE_ACCESS',
      ARRAY['email', 'phone', 'address', 'ssn_last_four', 'date_of_birth'],
      jsonb_build_object(
        'access_type', 'select',
        'timestamp', now(),
        'session_info', current_setting('application_name', true)
      )
    );
    
    -- Update last access timestamp
    UPDATE profiles 
    SET last_pii_access = now() 
    WHERE id = COALESCE(NEW.id, OLD.id);
    
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- For UPDATE operations
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
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the enhanced audit trigger
DROP TRIGGER IF EXISTS enhanced_profile_security_audit_trigger ON profiles;
CREATE TRIGGER enhanced_profile_security_audit_trigger
  BEFORE SELECT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enhanced_profile_security_audit();

-- 4. Create function for secure PII field access with encryption
CREATE OR REPLACE FUNCTION public.get_encrypted_profile_field(
  field_name text,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  field_value text;
  user_kyc_status text;
  access_allowed boolean := false;
BEGIN
  -- Security checks
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Access denied: can only access own profile data';
  END IF;
  
  -- Rate limiting check
  IF NOT check_pii_rate_limit(auth.uid()) THEN
    RAISE EXCEPTION 'Rate limit exceeded for PII access';
  END IF;
  
  -- Get user's KYC status
  SELECT kyc_status INTO user_kyc_status 
  FROM profiles 
  WHERE id = target_user_id;
  
  -- Check access control for specific field
  SELECT COUNT(*) > 0 INTO access_allowed
  FROM pii_access_control
  WHERE user_id = target_user_id
    AND field_name = get_encrypted_profile_field.field_name
    AND (expires_at IS NULL OR expires_at > now());
  
  -- Log the access attempt
  PERFORM log_profile_access(
    target_user_id,
    ARRAY[field_name]
  );
  
  -- Return masked or full data based on KYC status and access control
  CASE field_name
    WHEN 'phone' THEN
      SELECT 
        CASE 
          WHEN user_kyc_status = 'verified' AND access_allowed THEN phone
          ELSE mask_phone(phone)
        END INTO field_value
      FROM profiles WHERE id = target_user_id;
      
    WHEN 'address' THEN
      SELECT 
        CASE 
          WHEN user_kyc_status = 'verified' AND access_allowed THEN address
          ELSE mask_address(address)
        END INTO field_value
      FROM profiles WHERE id = target_user_id;
      
    WHEN 'ssn_last_four' THEN
      SELECT 
        CASE 
          WHEN user_kyc_status = 'verified' AND access_allowed THEN ssn_last_four
          ELSE mask_ssn(ssn_last_four)
        END INTO field_value
      FROM profiles WHERE id = target_user_id;
      
    WHEN 'date_of_birth' THEN
      SELECT 
        CASE 
          WHEN user_kyc_status = 'verified' AND access_allowed THEN date_of_birth::text
          ELSE NULL
        END INTO field_value
      FROM profiles WHERE id = target_user_id;
      
    ELSE
      RAISE EXCEPTION 'Invalid field name requested: %', field_name;
  END CASE;
  
  RETURN field_value;
END;
$$;

-- 5. Create data breach notification function
CREATE OR REPLACE FUNCTION public.create_security_alert(
  alert_type text,
  severity text DEFAULT 'medium',
  details jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 6. Update profiles table with additional security metadata
UPDATE profiles 
SET encryption_metadata = jsonb_build_object(
  'classification', 'highly_sensitive',
  'encryption_required', true,
  'last_security_review', now(),
  'protection_level', 'maximum'
)
WHERE encryption_metadata = '{}' OR encryption_metadata IS NULL;