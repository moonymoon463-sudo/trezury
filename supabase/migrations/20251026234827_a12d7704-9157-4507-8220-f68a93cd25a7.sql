-- Allow service role to read encrypted wallet keys for authenticated operations
CREATE POLICY "Service role can read encrypted keys for user operations"
ON encrypted_wallet_keys
FOR SELECT
TO service_role
USING (true);

-- Update the edge function config to ensure proper JWT verification
COMMENT ON POLICY "Service role can read encrypted keys for user operations" 
ON encrypted_wallet_keys 
IS 'Allows edge functions running as service role to decrypt and use wallet keys for authenticated user operations like transfers and trading';