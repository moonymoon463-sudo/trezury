-- Fix remaining security vulnerabilities

-- 1. Fix function search path security issue
CREATE OR REPLACE FUNCTION public.get_public_config(key_name text)
RETURNS text AS $$
BEGIN
  -- Only allow specific public config keys
  IF key_name IN ('app_name', 'support_email', 'terms_version') THEN
    RETURN (SELECT value FROM config WHERE key = key_name);
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;