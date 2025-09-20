-- Create comprehensive fee analytics function
CREATE OR REPLACE FUNCTION public.admin_get_fee_analytics(
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  trading_fees NUMERIC := 0;
  lending_fees NUMERIC := 0;
  swap_fees NUMERIC := 0;
  collected_fees NUMERIC := 0;
  pending_fees NUMERIC := 0;
  collection_success_rate NUMERIC := 0;
BEGIN
  -- Check if requesting user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Set default date range if not provided (last 30 days)
  IF start_date IS NULL THEN
    start_date := NOW() - INTERVAL '30 days';
  END IF;
  IF end_date IS NULL THEN
    end_date := NOW();
  END IF;

  -- Calculate trading fees from transactions
  SELECT COALESCE(SUM(
    CASE 
      WHEN metadata->>'platform_fee_usd' IS NOT NULL 
      THEN (metadata->>'platform_fee_usd')::NUMERIC
      ELSE 0
    END
  ), 0) INTO trading_fees
  FROM transactions
  WHERE created_at BETWEEN start_date AND end_date
    AND type IN ('buy', 'sell')
    AND status = 'completed';

  -- Calculate lending fees from payouts (1.8% of interest)
  SELECT COALESCE(SUM(platform_fee_dec), 0) INTO lending_fees
  FROM payouts
  WHERE ts BETWEEN start_date AND end_date;

  -- Calculate swap fees from transaction metadata
  SELECT COALESCE(SUM(
    CASE 
      WHEN metadata->>'swap_fee_usd' IS NOT NULL 
      THEN (metadata->>'swap_fee_usd')::NUMERIC
      ELSE 0
    END
  ), 0) INTO swap_fees
  FROM transactions
  WHERE created_at BETWEEN start_date AND end_date
    AND type = 'swap'
    AND status = 'completed';

  -- Calculate collected fees from fee collection requests
  SELECT COALESCE(SUM(amount), 0) INTO collected_fees
  FROM fee_collection_requests
  WHERE created_at BETWEEN start_date AND end_date
    AND status = 'completed';

  -- Calculate pending fees
  SELECT COALESCE(SUM(amount), 0) INTO pending_fees
  FROM fee_collection_requests
  WHERE created_at BETWEEN start_date AND end_date
    AND status = 'pending';

  -- Calculate collection success rate
  WITH collection_stats AS (
    SELECT 
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(*) as total
    FROM fee_collection_requests
    WHERE created_at BETWEEN start_date AND end_date
  )
  SELECT 
    CASE 
      WHEN total > 0 THEN (completed::NUMERIC / total::NUMERIC) * 100
      ELSE 0
    END INTO collection_success_rate
  FROM collection_stats;

  -- Build comprehensive result
  SELECT json_build_object(
    'period', json_build_object(
      'start_date', start_date,
      'end_date', end_date
    ),
    'fee_breakdown', json_build_object(
      'trading_fees', trading_fees,
      'lending_fees', lending_fees,
      'swap_fees', swap_fees,
      'total_fees', trading_fees + lending_fees + swap_fees
    ),
    'collection_status', json_build_object(
      'collected_fees', collected_fees,
      'pending_fees', pending_fees,
      'success_rate', collection_success_rate
    ),
    'recent_activity', (
      SELECT json_agg(
        json_build_object(
          'date', DATE(created_at),
          'amount', amount,
          'asset', asset,
          'transaction_type', (
            SELECT type FROM transactions 
            WHERE id = fee_collection_requests.transaction_id
          )
        )
      )
      FROM fee_collection_requests
      WHERE created_at BETWEEN start_date AND end_date
        AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 10
    ),
    'monthly_trends', (
      SELECT json_agg(
        json_build_object(
          'month', to_char(month_date, 'YYYY-MM'),
          'total_fees', monthly_fees
        )
        ORDER BY month_date
      )
      FROM (
        SELECT 
          date_trunc('month', created_at) as month_date,
          SUM(
            CASE 
              WHEN metadata->>'platform_fee_usd' IS NOT NULL 
              THEN (metadata->>'platform_fee_usd')::NUMERIC
              ELSE 0
            END
          ) as monthly_fees
        FROM transactions
        WHERE created_at >= start_date - INTERVAL '12 months'
          AND created_at <= end_date
          AND status = 'completed'
        GROUP BY date_trunc('month', created_at)
      ) monthly_data
    )
  ) INTO result;

  RETURN result;
END;
$$;