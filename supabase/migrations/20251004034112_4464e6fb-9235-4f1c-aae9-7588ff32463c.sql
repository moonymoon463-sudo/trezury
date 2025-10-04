-- Create function to validate gold price inserts
CREATE OR REPLACE FUNCTION validate_gold_price_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  last_price RECORD;
  price_change_pct NUMERIC;
  recent_insert_count INTEGER;
BEGIN
  -- Only validate for service role inserts (edge functions)
  IF (auth.jwt() ->> 'role'::text) = 'service_role' THEN
    
    -- Rate limiting: Max 1 insert per minute from same source
    SELECT COUNT(*) INTO recent_insert_count
    FROM gold_prices
    WHERE source = NEW.source
      AND timestamp > NOW() - INTERVAL '1 minute';
    
    IF recent_insert_count >= 1 THEN
      RAISE EXCEPTION 'Rate limit exceeded: Maximum 1 gold price insert per minute per source';
    END IF;
    
    -- Get the last price to validate reasonableness
    SELECT usd_per_oz, timestamp INTO last_price
    FROM gold_prices
    WHERE source = NEW.source
    ORDER BY timestamp DESC
    LIMIT 1;
    
    -- If we have a previous price, validate the change
    IF last_price.usd_per_oz IS NOT NULL THEN
      -- Calculate percentage change
      price_change_pct := ABS((NEW.usd_per_oz - last_price.usd_per_oz) / last_price.usd_per_oz * 100);
      
      -- Reject if price changed more than 10% in less than 1 hour
      IF price_change_pct > 10 AND (NEW.timestamp - last_price.timestamp) < INTERVAL '1 hour' THEN
        -- Log security alert
        INSERT INTO security_alerts (
          alert_type, severity, title, description, metadata
        ) VALUES (
          'suspicious_gold_price',
          'high',
          'Suspicious Gold Price Insert Blocked',
          'Gold price insert rejected: unreasonable price change detected',
          jsonb_build_object(
            'new_price', NEW.usd_per_oz,
            'last_price', last_price.usd_per_oz,
            'change_pct', price_change_pct,
            'source', NEW.source,
            'timestamp', NEW.timestamp
          )
        );
        
        RAISE EXCEPTION 'Invalid gold price: %.2f%% change from $% to $% is too large', 
          price_change_pct, last_price.usd_per_oz, NEW.usd_per_oz;
      END IF;
      
      -- Warning for 5-10% changes (log but allow)
      IF price_change_pct > 5 THEN
        INSERT INTO security_alerts (
          alert_type, severity, title, description, metadata
        ) VALUES (
          'large_gold_price_change',
          'medium',
          'Large Gold Price Change Detected',
          'Gold price changed significantly but within acceptable limits',
          jsonb_build_object(
            'new_price', NEW.usd_per_oz,
            'last_price', last_price.usd_per_oz,
            'change_pct', price_change_pct,
            'source', NEW.source
          )
        );
      END IF;
    END IF;
    
    -- Validate price is within reasonable bounds (gold is typically $1500-$3000/oz)
    IF NEW.usd_per_oz < 1000 OR NEW.usd_per_oz > 5000 THEN
      INSERT INTO security_alerts (
        alert_type, severity, title, description, metadata
      ) VALUES (
        'out_of_bounds_gold_price',
        'critical',
        'Out of Bounds Gold Price Blocked',
        'Gold price insert rejected: price outside historical ranges',
        jsonb_build_object(
          'price', NEW.usd_per_oz,
          'source', NEW.source,
          'expected_range', '$1000-$5000/oz'
        )
      );
      
      RAISE EXCEPTION 'Invalid gold price: $% is outside acceptable range ($1000-$5000/oz)', NEW.usd_per_oz;
    END IF;
    
    -- Validate source is from approved edge function
    IF NEW.source NOT IN ('metals-api', 'alpha_vantage', 'goldapi', 'manual_admin') THEN
      INSERT INTO security_alerts (
        alert_type, severity, title, description, metadata
      ) VALUES (
        'unauthorized_gold_price_source',
        'high',
        'Unauthorized Gold Price Source Blocked',
        'Gold price insert rejected: unknown source',
        jsonb_build_object(
          'source', NEW.source,
          'approved_sources', ARRAY['metals-api', 'alpha_vantage', 'goldapi', 'manual_admin']
        )
      );
      
      RAISE EXCEPTION 'Invalid source: % is not an approved gold price source', NEW.source;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS validate_gold_price_before_insert ON gold_prices;

-- Create trigger to validate all gold price inserts
CREATE TRIGGER validate_gold_price_before_insert
  BEFORE INSERT ON gold_prices
  FOR EACH ROW
  EXECUTE FUNCTION validate_gold_price_insert();

-- Add comment for documentation
COMMENT ON FUNCTION validate_gold_price_insert() IS 
'Validates gold price inserts to prevent market manipulation:
- Rate limiting: 1 insert per minute per source
- Price validation: Rejects >10% changes within 1 hour
- Bounds checking: $1000-$5000/oz acceptable range
- Source verification: Only approved sources allowed
- Security alerts: Logs suspicious activity';