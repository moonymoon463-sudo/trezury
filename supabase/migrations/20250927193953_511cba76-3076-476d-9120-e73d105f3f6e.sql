-- Fix Critical Security Issue: Restrict deployment logs and contracts to admin-only access
-- First check and drop existing policies safely

DROP POLICY IF EXISTS "Anyone can view deployment logs" ON deployment_logs;
DROP POLICY IF EXISTS "Service role can insert deployment logs" ON deployment_logs;
DROP POLICY IF EXISTS "Users can view deployed contracts" ON deployed_contracts; 
DROP POLICY IF EXISTS "Service role can manage deployed contracts" ON deployed_contracts;

-- Create admin-only read access for deployment logs
CREATE POLICY "Admin only access to deployment logs"
ON deployment_logs
FOR SELECT
USING (is_admin(auth.uid()));

-- Service role can still insert logs
CREATE POLICY "Service role can insert deployment logs" 
ON deployment_logs
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- Create admin-only read access for deployed contracts
CREATE POLICY "Admin only access to deployed contracts"
ON deployed_contracts  
FOR SELECT
USING (is_admin(auth.uid()));

-- Service role can manage deployed contracts
CREATE POLICY "Service role manages deployed contracts"
ON deployed_contracts
FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');