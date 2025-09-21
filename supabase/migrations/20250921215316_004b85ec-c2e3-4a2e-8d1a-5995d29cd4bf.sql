-- Fix numeric overflow on pool_stats.utilization_fp during supply/withdraw updates
-- 1) Increase precision/scale
ALTER TABLE public.pool_stats
ALTER COLUMN utilization_fp TYPE NUMERIC(20,8);

-- 2) Harden update_pool_statistics trigger function: clamp utilization to [0,1] and guard division
CREATE OR REPLACE FUNCTION public.update_pool_statistics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
BEGIN
  -- Update pool stats when supplies change
  IF TG_TABLE_NAME = 'user_supplies' THEN
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
  
  -- Recalculate derived fields safely
  UPDATE pool_stats 
  SET 
    utilization_fp = CASE 
      WHEN total_deposits_dec > 0 THEN LEAST(total_borrowed_dec / NULLIF(total_deposits_dec, 0), 1)
      ELSE 0 
    END,
    reserve_balance_dec = total_deposits_dec - total_borrowed_dec,
    updated_ts = now()
  WHERE token = COALESCE(NEW.asset, OLD.asset) 
    AND chain = COALESCE(NEW.chain, OLD.chain);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;