-- Remove KYC-specific timestamp fields from profiles table
-- Keep kyc_status for webhook processing
ALTER TABLE profiles 
  DROP COLUMN IF EXISTS kyc_submitted_at,
  DROP COLUMN IF EXISTS kyc_verified_at,
  DROP COLUMN IF EXISTS kyc_rejection_reason;

-- Note: kyc_status column is retained for MoonPay webhook updates