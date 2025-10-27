-- Drop the unnecessary service role policy
-- The existing "Users access only their own encrypted keys" policy is sufficient
-- when the edge function forwards the user's JWT
DROP POLICY IF EXISTS "Service role can read encrypted keys for user operations" ON encrypted_wallet_keys;