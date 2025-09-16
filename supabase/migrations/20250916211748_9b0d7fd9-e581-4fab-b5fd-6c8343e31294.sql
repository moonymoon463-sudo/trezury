-- Fix security vulnerabilities

-- 1. Restrict config table access to prevent business data exposure
DROP POLICY IF EXISTS "Config restricted access" ON config;
CREATE POLICY "Config admin only access" ON config 
FOR ALL USING (false); -- No user access, only system/admin

-- 2. Create a secure function to get public configuration (if needed)
CREATE OR REPLACE FUNCTION public.get_public_config(key_name text)
RETURNS text AS $$
BEGIN
  -- Only allow specific public config keys
  IF key_name IN ('app_name', 'support_email', 'terms_version') THEN
    RETURN (SELECT value FROM config WHERE key = key_name);
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;