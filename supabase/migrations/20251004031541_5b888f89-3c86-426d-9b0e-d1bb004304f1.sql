-- Drop and recreate the masked view to avoid column rename errors
DROP VIEW IF EXISTS public.v_profiles_masked;

CREATE VIEW public.v_profiles_masked AS
SELECT
  id,
  email,
  public.mask_phone(phone) AS masked_phone,
  kyc_status,
  created_at,
  updated_at
FROM public.profiles;

-- Ensure authenticated users have required privileges
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.v_profiles_masked TO authenticated;