-- Remove ETH from pool reserves and add XAUT markets
DELETE FROM pool_reserves WHERE asset = 'WETH' OR asset = 'ETH';

-- Insert XAUT lending markets for multiple chains
INSERT INTO pool_reserves (
  asset, 
  chain, 
  total_supply_dec, 
  total_borrowed_dec, 
  available_liquidity_dec,
  utilization_rate,
  supply_rate,
  borrow_rate_variable,
  borrow_rate_stable,
  ltv,
  liquidation_threshold,
  liquidation_bonus,
  reserve_factor,
  is_active,
  borrowing_enabled,
  stable_rate_enabled
) VALUES 
-- XAUT on Ethereum
('XAUT', 'ethereum', 100000, 25000, 75000, 0.25, 0.045, 0.065, 0.070, 0.70, 0.75, 0.10, 0.20, true, true, false),
-- XAUT on Base
('XAUT', 'base', 50000, 12000, 38000, 0.24, 0.042, 0.062, 0.067, 0.70, 0.75, 0.10, 0.20, true, true, false)
ON CONFLICT (asset, chain) DO UPDATE SET
  supply_rate = EXCLUDED.supply_rate,
  borrow_rate_variable = EXCLUDED.borrow_rate_variable,
  ltv = EXCLUDED.ltv,
  liquidation_threshold = EXCLUDED.liquidation_threshold,
  updated_at = now();

-- Update existing stablecoin markets to have competitive rates
UPDATE pool_reserves 
SET 
  supply_rate = 0.055,
  borrow_rate_variable = 0.075,
  updated_at = now()
WHERE asset IN ('USDC', 'USDT', 'DAI');

-- Update interest rate models to remove ETH
DELETE FROM interest_rate_models WHERE asset = 'WETH' OR asset = 'ETH';

-- Add XAUT interest rate model
INSERT INTO interest_rate_models (
  asset,
  chain,
  base_variable_borrow_rate,
  variable_rate_slope1,
  variable_rate_slope2,
  base_stable_borrow_rate,
  stable_rate_slope1,
  stable_rate_slope2,
  optimal_utilization_rate
) VALUES 
('XAUT', 'ethereum', 0.04, 0.08, 1.5, 0.06, 0.04, 1.0, 0.70),
('XAUT', 'base', 0.04, 0.08, 1.5, 0.06, 0.04, 1.0, 0.70)
ON CONFLICT (asset, chain) DO UPDATE SET
  base_variable_borrow_rate = EXCLUDED.base_variable_borrow_rate,
  variable_rate_slope1 = EXCLUDED.variable_rate_slope1,
  variable_rate_slope2 = EXCLUDED.variable_rate_slope2,
  updated_at = now();