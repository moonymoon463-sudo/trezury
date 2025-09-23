-- Fix network mismatch: Update all wallet addresses to use ethereum mainnet
UPDATE onchain_addresses 
SET chain = 'ethereum' 
WHERE chain IN ('sepolia', 'base');

-- Verify the update
SELECT 'Updated' as status, COUNT(*) as count FROM onchain_addresses WHERE chain = 'ethereum';