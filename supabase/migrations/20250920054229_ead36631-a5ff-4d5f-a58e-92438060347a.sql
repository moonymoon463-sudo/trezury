-- Update admin dashboard stats function to include chain-specific fee analytics
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  total_fees_collected NUMERIC := 0;
  fees_this_month NUMERIC := 0;
  pending_fee_collections NUMERIC := 0;
  fee_collection_rate NUMERIC := 0;
  chain_breakdown JSONB;
BEGIN
  -- Check if requesting user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Calculate total fees collected from fee collection requests
  SELECT COALESCE(SUM(amount), 0) INTO total_fees_collected
  FROM fee_collection_requests
  WHERE status = 'completed';

  -- Calculate fees this month
  SELECT COALESCE(SUM(amount), 0) INTO fees_this_month
  FROM fee_collection_requests
  WHERE status = 'completed'
    AND created_at >= date_trunc('month', NOW());

  -- Calculate pending fee collections
  SELECT COALESCE(SUM(amount), 0) INTO pending_fee_collections
  FROM fee_collection_requests
  WHERE status = 'pending';

  -- Calculate fee collection success rate (last 30 days)
  WITH collection_stats AS (
    SELECT 
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(*) as total
    FROM fee_collection_requests
    WHERE created_at >= NOW() - INTERVAL '30 days'
  )
  SELECT 
    CASE 
      WHEN total > 0 THEN (completed::NUMERIC / total::NUMERIC) * 100
      ELSE 0
    END INTO fee_collection_rate
  FROM collection_stats;

  -- Get chain-specific breakdown
  SELECT 
    jsonb_object_agg(
      COALESCE(chain, 'ethereum'), 
      jsonb_build_object(
        'collected', COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0),
        'pending', COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0),
        'count', COUNT(*)
      )
    ) INTO chain_breakdown
  FROM fee_collection_requests
  WHERE created_at >= NOW() - INTERVAL '30 days';

  -- Build result with existing and new metrics
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'verified_users', (SELECT COUNT(*) FROM profiles WHERE kyc_status = 'verified'),
    'total_transactions', (SELECT COUNT(*) FROM transactions),
    'total_volume_usd', (SELECT COALESCE(SUM(quantity * unit_price_usd), 0) FROM transactions WHERE status = 'completed'),
    'active_locks', (SELECT COUNT(*) FROM locks WHERE status = 'active'),
    'total_locked_value', (SELECT COALESCE(SUM(amount_dec), 0) FROM locks WHERE status = 'active'),
    'pending_kyc', (SELECT COUNT(*) FROM profiles WHERE kyc_status = 'pending'),
    'recent_signups', (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '7 days'),
    'total_fees_collected', total_fees_collected,
    'fees_this_month', fees_this_month,
    'pending_fee_collections', pending_fee_collections,
    'fee_collection_rate', fee_collection_rate,
    'chain_breakdown', COALESCE(chain_breakdown, '{}'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;

-- Update admin fee analytics function to include chain-specific analytics
CREATE OR REPLACE FUNCTION public.admin_get_fee_analytics_with_chains(
  start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  trading_fees NUMERIC := 0;
  lending_fees NUMERIC := 0;
  swap_fees NUMERIC := 0;
  collected_fees NUMERIC := 0;
  pending_fees NUMERIC := 0;
  collection_success_rate NUMERIC := 0;
  chain_analytics JSONB;
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

  -- Get chain-specific analytics
  SELECT 
    jsonb_object_agg(
      COALESCE(chain, 'ethereum'),
      jsonb_build_object(
        'collected', COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0),
        'pending', COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0),
        'failed', COALESCE(SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END), 0),
        'total_requests', COUNT(*),
        'success_rate', CASE 
          WHEN COUNT(*) > 0 THEN 
            (COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100
          ELSE 0 
        END
      )
    ) INTO chain_analytics
  FROM fee_collection_requests
  WHERE created_at BETWEEN start_date AND end_date;

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
    'chain_analytics', COALESCE(chain_analytics, '{}'::jsonb),
    'recent_activity', (
      SELECT json_agg(
        json_build_object(
          'date', DATE(created_at),
          'amount', amount,
          'asset', asset,
          'chain', COALESCE(chain, 'ethereum'),
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
$function$;