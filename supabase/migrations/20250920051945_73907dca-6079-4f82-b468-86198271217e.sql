-- Update admin dashboard stats function to include fee metrics
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  total_fees_collected NUMERIC := 0;
  fees_this_month NUMERIC := 0;
  pending_fee_collections NUMERIC := 0;
  fee_collection_rate NUMERIC := 0;
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
    'fee_collection_rate', fee_collection_rate
  ) INTO result;

  RETURN result;
END;
$$;