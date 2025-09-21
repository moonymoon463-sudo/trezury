-- Critical Data Infrastructure: Phase 1 Implementation

-- First, populate pool_stats with realistic test data
INSERT INTO pool_stats (token, chain, total_deposits_dec, total_borrowed_dec, reserve_balance_dec, utilization_fp, updated_ts) VALUES
('USDC', 'ethereum', 2500000, 1750000, 750000, 0.70, now()),
('USDT', 'ethereum', 1800000, 1260000, 540000, 0.70, now()),
('DAI', 'ethereum', 3200000, 1920000, 1280000, 0.60, now()),
('XAUT', 'ethereum', 950000, 665000, 285000, 0.70, now()),
('AURU', 'ethereum', 500000, 200000, 300000, 0.40, now()),
('USDC', 'base', 1200000, 720000, 480000, 0.60, now()),
('USDT', 'base', 800000, 480000, 320000, 0.60, now())
ON CONFLICT (token, chain) DO UPDATE SET
  total_deposits_dec = EXCLUDED.total_deposits_dec,
  total_borrowed_dec = EXCLUDED.total_borrowed_dec,
  reserve_balance_dec = EXCLUDED.reserve_balance_dec,
  utilization_fp = EXCLUDED.utilization_fp,
  updated_ts = EXCLUDED.updated_ts;

-- Populate pool_reserves with comprehensive data
INSERT INTO pool_reserves (asset, chain, supply_rate, borrow_rate_variable, borrow_rate_stable, total_supply_dec, total_borrowed_dec, available_liquidity_dec, utilization_rate, ltv, liquidation_threshold, liquidation_bonus, is_active, borrowing_enabled, stable_rate_enabled) VALUES
('USDC', 'ethereum', 0.045, 0.055, 0.065, 2500000, 1750000, 750000, 0.70, 0.85, 0.90, 0.05, true, true, true),
('USDT', 'ethereum', 0.038, 0.048, 0.058, 1800000, 1260000, 540000, 0.70, 0.85, 0.90, 0.05, true, true, true),
('DAI', 'ethereum', 0.052, 0.062, 0.072, 3200000, 1920000, 1280000, 0.60, 0.80, 0.85, 0.05, true, true, true),
('XAUT', 'ethereum', 0.088, 0.098, 0.108, 950000, 665000, 285000, 0.70, 0.75, 0.80, 0.10, true, true, true),
('AURU', 'ethereum', 0.125, 0.135, 0.145, 500000, 200000, 300000, 0.40, 0.65, 0.70, 0.15, true, true, true),
('USDC', 'base', 0.042, 0.052, 0.062, 1200000, 720000, 480000, 0.60, 0.85, 0.90, 0.05, true, true, true),
('USDT', 'base', 0.035, 0.045, 0.055, 800000, 480000, 320000, 0.60, 0.85, 0.90, 0.05, true, true, true)
ON CONFLICT (asset, chain) DO UPDATE SET
  supply_rate = EXCLUDED.supply_rate,
  borrow_rate_variable = EXCLUDED.borrow_rate_variable,
  borrow_rate_stable = EXCLUDED.borrow_rate_stable,
  total_supply_dec = EXCLUDED.total_supply_dec,
  total_borrowed_dec = EXCLUDED.total_borrowed_dec,
  available_liquidity_dec = EXCLUDED.available_liquidity_dec,
  utilization_rate = EXCLUDED.utilization_rate,
  ltv = EXCLUDED.ltv,
  liquidation_threshold = EXCLUDED.liquidation_threshold,
  liquidation_bonus = EXCLUDED.liquidation_bonus,
  updated_at = now();

-- Create interest rate models for realistic rate calculations
INSERT INTO interest_rate_models (asset, chain, base_variable_borrow_rate, variable_rate_slope1, variable_rate_slope2, optimal_utilization_rate, base_stable_borrow_rate, stable_rate_slope1, stable_rate_slope2) VALUES
('USDC', 'ethereum', 0.02, 0.04, 0.75, 0.80, 0.025, 0.02, 0.75),
('USDT', 'ethereum', 0.015, 0.035, 0.70, 0.80, 0.02, 0.015, 0.70),
('DAI', 'ethereum', 0.025, 0.045, 0.80, 0.75, 0.03, 0.025, 0.80),
('XAUT', 'ethereum', 0.04, 0.06, 1.0, 0.70, 0.045, 0.04, 1.0),
('AURU', 'ethereum', 0.05, 0.08, 1.25, 0.65, 0.055, 0.05, 1.25),
('USDC', 'base', 0.018, 0.038, 0.72, 0.80, 0.023, 0.018, 0.72),
('USDT', 'base', 0.013, 0.033, 0.68, 0.80, 0.018, 0.013, 0.68)
ON CONFLICT (asset, chain) DO UPDATE SET
  base_variable_borrow_rate = EXCLUDED.base_variable_borrow_rate,
  variable_rate_slope1 = EXCLUDED.variable_rate_slope1,
  variable_rate_slope2 = EXCLUDED.variable_rate_slope2,
  optimal_utilization_rate = EXCLUDED.optimal_utilization_rate,
  base_stable_borrow_rate = EXCLUDED.base_stable_borrow_rate,
  stable_rate_slope1 = EXCLUDED.stable_rate_slope1,
  stable_rate_slope2 = EXCLUDED.stable_rate_slope2,
  updated_at = now();

-- Enable real-time updates for key tables
ALTER TABLE pool_stats REPLICA IDENTITY FULL;
ALTER TABLE pool_reserves REPLICA IDENTITY FULL;
ALTER TABLE user_supplies REPLICA IDENTITY FULL;
ALTER TABLE user_borrows REPLICA IDENTITY FULL;
ALTER TABLE user_health_factors REPLICA IDENTITY FULL;
ALTER TABLE governance_rewards REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE pool_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE pool_reserves;
ALTER PUBLICATION supabase_realtime ADD TABLE user_supplies;
ALTER PUBLICATION supabase_realtime ADD TABLE user_borrows;
ALTER PUBLICATION supabase_realtime ADD TABLE user_health_factors;
ALTER PUBLICATION supabase_realtime ADD TABLE governance_rewards;

-- Create function to update pool statistics in real-time
CREATE OR REPLACE FUNCTION update_pool_statistics()
RETURNS TRIGGER AS $$
DECLARE
  pool_record RECORD;
BEGIN
  -- Get the asset and chain from the modified record
  IF TG_TABLE_NAME = 'user_supplies' THEN
    -- Update pool stats when supplies change
    UPDATE pool_stats 
    SET 
      total_deposits_dec = (
        SELECT COALESCE(SUM(supplied_amount_dec), 0) 
        FROM user_supplies 
        WHERE asset = COALESCE(NEW.asset, OLD.asset) 
        AND chain = COALESCE(NEW.chain, OLD.chain)
      ),
      updated_ts = now()
    WHERE token = COALESCE(NEW.asset, OLD.asset) 
    AND chain = COALESCE(NEW.chain, OLD.chain);
    
  ELSIF TG_TABLE_NAME = 'user_borrows' THEN
    -- Update pool stats when borrows change
    UPDATE pool_stats 
    SET 
      total_borrowed_dec = (
        SELECT COALESCE(SUM(borrowed_amount_dec), 0) 
        FROM user_borrows 
        WHERE asset = COALESCE(NEW.asset, OLD.asset) 
        AND chain = COALESCE(NEW.chain, OLD.chain)
      ),
      updated_ts = now()
    WHERE token = COALESCE(NEW.asset, OLD.asset) 
    AND chain = COALESCE(NEW.chain, OLD.chain);
  END IF;
  
  -- Update utilization ratio
  UPDATE pool_stats 
  SET 
    utilization_fp = CASE 
      WHEN total_deposits_dec > 0 THEN total_borrowed_dec / total_deposits_dec 
      ELSE 0 
    END,
    reserve_balance_dec = total_deposits_dec - total_borrowed_dec,
    updated_ts = now()
  WHERE token = COALESCE(NEW.asset, OLD.asset) 
  AND chain = COALESCE(NEW.chain, OLD.chain);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for real-time pool updates
DROP TRIGGER IF EXISTS update_pool_on_supply_change ON user_supplies;
CREATE TRIGGER update_pool_on_supply_change
  AFTER INSERT OR UPDATE OR DELETE ON user_supplies
  FOR EACH ROW EXECUTE FUNCTION update_pool_statistics();

DROP TRIGGER IF EXISTS update_pool_on_borrow_change ON user_borrows;
CREATE TRIGGER update_pool_on_borrow_change
  AFTER INSERT OR UPDATE OR DELETE ON user_borrows
  FOR EACH ROW EXECUTE FUNCTION update_pool_statistics();

-- Create function for compound interest accrual
CREATE OR REPLACE FUNCTION accrue_compound_interest()
RETURNS void AS $$
DECLARE
  supply_record RECORD;
  borrow_record RECORD;
  time_elapsed_hours NUMERIC;
  annual_rate NUMERIC;
  compound_factor NUMERIC;
BEGIN
  -- Accrue interest on all active supplies
  FOR supply_record IN 
    SELECT * FROM user_supplies 
    WHERE supplied_amount_dec > 0 
    AND last_interest_update < now() - INTERVAL '1 hour'
  LOOP
    -- Calculate time elapsed in hours
    time_elapsed_hours := EXTRACT(EPOCH FROM (now() - supply_record.last_interest_update)) / 3600;
    
    -- Get current supply rate from pool reserves
    SELECT supply_rate INTO annual_rate 
    FROM pool_reserves 
    WHERE asset = supply_record.asset 
    AND chain = supply_record.chain;
    
    IF annual_rate IS NOT NULL THEN
      -- Calculate compound interest factor (hourly compounding)
      compound_factor := POWER(1 + (annual_rate / 8760), time_elapsed_hours);
      
      -- Update supply amount and accrued interest
      UPDATE user_supplies 
      SET 
        supplied_amount_dec = supplied_amount_dec * compound_factor,
        accrued_interest_dec = accrued_interest_dec + (supplied_amount_dec * (compound_factor - 1)),
        last_interest_update = now()
      WHERE id = supply_record.id;
    END IF;
  END LOOP;
  
  -- Accrue interest on all active borrows
  FOR borrow_record IN 
    SELECT * FROM user_borrows 
    WHERE borrowed_amount_dec > 0 
    AND last_interest_update < now() - INTERVAL '1 hour'
  LOOP
    -- Calculate time elapsed in hours
    time_elapsed_hours := EXTRACT(EPOCH FROM (now() - borrow_record.last_interest_update)) / 3600;
    
    -- Get current borrow rate from pool reserves
    SELECT 
      CASE 
        WHEN borrow_record.rate_mode = 'stable' THEN borrow_rate_stable
        ELSE borrow_rate_variable
      END INTO annual_rate 
    FROM pool_reserves 
    WHERE asset = borrow_record.asset 
    AND chain = borrow_record.chain;
    
    IF annual_rate IS NOT NULL THEN
      -- Calculate compound interest factor (hourly compounding)
      compound_factor := POWER(1 + (annual_rate / 8760), time_elapsed_hours);
      
      -- Update borrow amount and accrued interest
      UPDATE user_borrows 
      SET 
        borrowed_amount_dec = borrowed_amount_dec * compound_factor,
        accrued_interest_dec = accrued_interest_dec + (borrowed_amount_dec * (compound_factor - 1)),
        last_interest_update = now()
      WHERE id = borrow_record.id;
    END IF;
  END LOOP;
  
END;
$$ LANGUAGE plpgsql;

-- Create function to automatically distribute governance rewards
CREATE OR REPLACE FUNCTION distribute_governance_rewards()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  total_auru_supplied NUMERIC := 0;
  weekly_reward_pool NUMERIC := 50000; -- 50k AURU per week
  user_reward NUMERIC;
BEGIN
  -- Calculate total AURU supplied across all users
  SELECT COALESCE(SUM(supplied_amount_dec), 0) INTO total_auru_supplied
  FROM user_supplies 
  WHERE asset = 'AURU' AND supplied_amount_dec > 0;
  
  -- Only distribute if there are AURU suppliers
  IF total_auru_supplied > 0 THEN
    -- Calculate and distribute rewards for each AURU supplier
    FOR user_record IN 
      SELECT user_id, supplied_amount_dec, chain
      FROM user_supplies 
      WHERE asset = 'AURU' AND supplied_amount_dec > 0
    LOOP
      -- Calculate proportional reward
      user_reward := (user_record.supplied_amount_dec / total_auru_supplied) * weekly_reward_pool;
      
      -- Insert governance reward
      INSERT INTO governance_rewards (
        user_id, 
        amount_dec, 
        reward_type, 
        asset, 
        chain, 
        metadata
      ) VALUES (
        user_record.user_id,
        user_reward,
        'weekly_supply_reward',
        'AURU',
        user_record.chain,
        jsonb_build_object(
          'total_pool', weekly_reward_pool,
          'user_share', user_record.supplied_amount_dec / total_auru_supplied,
          'calculation_date', now()
        )
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;