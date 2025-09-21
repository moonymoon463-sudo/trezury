-- Fix remaining numeric columns that are causing overflow
-- Update all rate-related columns to have proper precision

-- Fix user_supplies table
ALTER TABLE user_supplies 
ALTER COLUMN supply_rate_at_deposit TYPE NUMERIC(10,8);

-- Fix pool_reserves rate columns
ALTER TABLE pool_reserves
ALTER COLUMN supply_rate TYPE NUMERIC(10,8),
ALTER COLUMN borrow_rate_variable TYPE NUMERIC(10,8),
ALTER COLUMN borrow_rate_stable TYPE NUMERIC(10,8),
ALTER COLUMN ltv TYPE NUMERIC(10,8),
ALTER COLUMN liquidation_threshold TYPE NUMERIC(10,8),
ALTER COLUMN liquidation_bonus TYPE NUMERIC(10,8),
ALTER COLUMN reserve_factor TYPE NUMERIC(10,8),
ALTER COLUMN utilization_rate TYPE NUMERIC(10,8);

-- Fix user_borrows rate column
ALTER TABLE user_borrows
ALTER COLUMN borrow_rate_at_creation TYPE NUMERIC(10,8);

-- Fix user_health_factors rate columns
ALTER TABLE user_health_factors
ALTER COLUMN health_factor TYPE NUMERIC(10,8),
ALTER COLUMN ltv TYPE NUMERIC(10,8),
ALTER COLUMN liquidation_threshold TYPE NUMERIC(10,8);

-- Add helpful comments
COMMENT ON COLUMN user_supplies.supply_rate_at_deposit IS 'Interest rate at time of deposit with 10 digits total, 8 decimal places';
COMMENT ON COLUMN pool_reserves.supply_rate IS 'Current supply interest rate with 10 digits total, 8 decimal places';