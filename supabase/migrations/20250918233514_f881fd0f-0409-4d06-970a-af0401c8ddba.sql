-- Fix critical security policies for production readiness (without admin user creation)

-- 1. Fix payment_transactions table - restrict system access to service role only
DROP POLICY IF EXISTS "System can insert payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "System can update payment transactions" ON payment_transactions;

CREATE POLICY "Service role can insert payment transactions" 
ON payment_transactions 
FOR INSERT 
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can update payment transactions" 
ON payment_transactions 
FOR UPDATE 
USING (auth.jwt() ->> 'role' = 'service_role');

-- 2. Fix fee_collection_requests table - restrict system access to service role only
DROP POLICY IF EXISTS "System can insert fee collection requests" ON fee_collection_requests;
DROP POLICY IF EXISTS "System can update fee collection requests" ON fee_collection_requests;

CREATE POLICY "Service role can insert fee collection requests" 
ON fee_collection_requests 
FOR INSERT 
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can update fee collection requests" 
ON fee_collection_requests 
FOR UPDATE 
USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. Simplify profiles table policies - remove complex function calls for production safety
DROP POLICY IF EXISTS "Enhanced PII protection with rate limiting" ON profiles;
DROP POLICY IF EXISTS "Secure profile access with enhanced logging" ON profiles;

-- Create simple, secure profile access policy
CREATE POLICY "Users can only access own profile data" 
ON profiles 
FOR SELECT 
USING (auth.uid() = id);

-- 4. Enhance KYC documents policy to ensure strict user ownership
DROP POLICY IF EXISTS "Restricted KYC document metadata access" ON kyc_documents;

CREATE POLICY "Users can only view own KYC documents" 
ON kyc_documents 
FOR SELECT 
USING (auth.uid() = user_id AND upload_status = 'uploaded');