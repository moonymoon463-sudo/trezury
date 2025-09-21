-- Fix numeric precision issues in lending tables
-- Increase precision for all amount fields to handle larger values

-- Update user_supplies table
ALTER TABLE user_supplies 
ALTER COLUMN supplied_amount_dec TYPE NUMERIC(20,6),
ALTER COLUMN accrued_interest_dec TYPE NUMERIC(20,6);

-- Update user_borrows table  
ALTER TABLE user_borrows
ALTER COLUMN borrowed_amount_dec TYPE NUMERIC(20,6),
ALTER COLUMN accrued_interest_dec TYPE NUMERIC(20,6);

-- Update pool_reserves table
ALTER TABLE pool_reserves
ALTER COLUMN total_supply_dec TYPE NUMERIC(20,6),
ALTER COLUMN total_borrowed_dec TYPE NUMERIC(20,6), 
ALTER COLUMN available_liquidity_dec TYPE NUMERIC(20,6);

-- Update user_health_factors table
ALTER TABLE user_health_factors
ALTER COLUMN total_collateral_usd TYPE NUMERIC(20,6),
ALTER COLUMN total_debt_usd TYPE NUMERIC(20,6),
ALTER COLUMN available_borrow_usd TYPE NUMERIC(20,6);

-- Update balance_snapshots table
ALTER TABLE balance_snapshots
ALTER COLUMN amount TYPE NUMERIC(20,6);

-- Add comment for documentation
COMMENT ON COLUMN user_supplies.supplied_amount_dec IS 'User supplied amount with 20 digits total, 6 decimal places';
COMMENT ON COLUMN pool_reserves.total_supply_dec IS 'Total pool supply with 20 digits total, 6 decimal places';