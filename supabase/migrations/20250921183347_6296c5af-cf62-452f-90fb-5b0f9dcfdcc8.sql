-- Initialize pool statistics for pre-deployed contracts
INSERT INTO pool_stats (chain, token, total_deposits_dec, total_borrowed_dec, utilization_fp, reserve_balance_dec)
VALUES 
  ('ethereum', 'USDC', 1000000, 750000, 0.75, 250000),
  ('ethereum', 'DAI', 500000, 300000, 0.60, 200000),
  ('ethereum', 'USDT', 800000, 600000, 0.75, 200000),
  ('ethereum', 'XAUT', 100000, 60000, 0.60, 40000),
  ('ethereum', 'AURU', 200000, 50000, 0.25, 150000)
ON CONFLICT (chain, token) DO UPDATE SET
  total_deposits_dec = EXCLUDED.total_deposits_dec,
  total_borrowed_dec = EXCLUDED.total_borrowed_dec,
  utilization_fp = EXCLUDED.utilization_fp,
  reserve_balance_dec = EXCLUDED.reserve_balance_dec,
  updated_ts = now();

-- Initialize pool reserves for pre-deployed contracts with realistic rates
INSERT INTO pool_reserves (
  chain, asset, supply_rate, borrow_rate_variable, borrow_rate_stable,
  utilization_rate, available_liquidity_dec, total_borrowed_dec, total_supply_dec,
  ltv, liquidation_threshold, liquidation_bonus, reserve_factor,
  is_active, borrowing_enabled, stable_rate_enabled
) VALUES 
  ('ethereum', 'USDC', 0.025, 0.035, 0.045, 0.75, 250000, 750000, 1000000, 0.80, 0.85, 0.05, 0.10, true, true, true),
  ('ethereum', 'DAI', 0.022, 0.032, 0.042, 0.60, 200000, 300000, 500000, 0.80, 0.85, 0.05, 0.10, true, true, true),
  ('ethereum', 'USDT', 0.020, 0.030, 0.040, 0.75, 200000, 600000, 800000, 0.80, 0.85, 0.05, 0.10, true, true, true),
  ('ethereum', 'XAUT', 0.035, 0.055, 0.065, 0.60, 40000, 60000, 100000, 0.70, 0.75, 0.10, 0.20, true, true, false),
  ('ethereum', 'AURU', 0.080, 0.120, 0.000, 0.25, 150000, 50000, 200000, 0.50, 0.60, 0.15, 0.30, true, false, false)
ON CONFLICT (chain, asset) DO UPDATE SET
  supply_rate = EXCLUDED.supply_rate,
  borrow_rate_variable = EXCLUDED.borrow_rate_variable,
  borrow_rate_stable = EXCLUDED.borrow_rate_stable,
  utilization_rate = EXCLUDED.utilization_rate,
  available_liquidity_dec = EXCLUDED.available_liquidity_dec,
  total_borrowed_dec = EXCLUDED.total_borrowed_dec,
  total_supply_dec = EXCLUDED.total_supply_dec,
  updated_at = now();