-- Remove Persona-specific columns from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS kyc_inquiry_id;

-- Drop related index if it exists
DROP INDEX IF EXISTS idx_profiles_kyc_inquiry_id;