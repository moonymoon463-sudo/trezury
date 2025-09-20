-- Add Persona inquiry ID field to profiles table for third-party KYC integration
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS kyc_inquiry_id TEXT;

-- Create index for efficient lookups by inquiry ID
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_inquiry_id 
ON public.profiles(kyc_inquiry_id) 
WHERE kyc_inquiry_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.kyc_inquiry_id IS 'Persona inquiry ID for third-party KYC verification';