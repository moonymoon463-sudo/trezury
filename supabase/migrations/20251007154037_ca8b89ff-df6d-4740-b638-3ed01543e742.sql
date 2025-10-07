-- Create RPC function for fee collection dashboard stats
CREATE OR REPLACE FUNCTION admin_get_fee_collection_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result JSON;
  pending_count INTEGER;
  pending_amount NUMERIC;
  success_rate_24h NUMERIC;
  success_rate_7d NUMERIC;
  last_collection_data JSON;
  avg_collection_time INTERVAL;
  failed_count INTEGER;
  failed_amount NUMERIC;
BEGIN
  -- Check if requesting user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Get pending requests count and amount
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO pending_count, pending_amount
  FROM fee_collection_requests
  WHERE status = 'pending';

  -- Calculate success rate for last 24 hours
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN 
        (COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100
      ELSE 0
    END
  INTO success_rate_24h
  FROM fee_collection_requests
  WHERE created_at >= NOW() - INTERVAL '24 hours';

  -- Calculate success rate for last 7 days
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN 
        (COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100
      ELSE 0
    END
  INTO success_rate_7d
  FROM fee_collection_requests
  WHERE created_at >= NOW() - INTERVAL '7 days';

  -- Get last collection data
  SELECT json_build_object(
    'completed_at', completed_at,
    'amount', amount,
    'asset', asset,
    'chain', COALESCE(chain, 'ethereum')
  )
  INTO last_collection_data
  FROM fee_collection_requests
  WHERE status = 'completed'
  ORDER BY completed_at DESC
  LIMIT 1;

  -- Calculate average time from creation to completion
  SELECT AVG(completed_at - created_at)
  INTO avg_collection_time
  FROM fee_collection_requests
  WHERE status = 'completed'
    AND completed_at >= NOW() - INTERVAL '30 days';

  -- Get failed collection stats
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO failed_count, failed_amount
  FROM fee_collection_requests
  WHERE status = 'failed'
    AND created_at >= NOW() - INTERVAL '30 days';

  -- Build comprehensive result
  SELECT json_build_object(
    'pending_count', COALESCE(pending_count, 0),
    'pending_amount', COALESCE(pending_amount, 0),
    'success_rate_24h', COALESCE(success_rate_24h, 0),
    'success_rate_7d', COALESCE(success_rate_7d, 0),
    'last_collection', last_collection_data,
    'avg_collection_time_seconds', COALESCE(EXTRACT(EPOCH FROM avg_collection_time)::INTEGER, 0),
    'failed_count', COALESCE(failed_count, 0),
    'failed_amount', COALESCE(failed_amount, 0),
    'batch_history', (
      SELECT json_agg(
        json_build_object(
          'date', batch_date,
          'completed_count', completed_count,
          'failed_count', failed_count,
          'total_amount', total_amount,
          'success_rate', success_rate,
          'chain', chain
        )
        ORDER BY batch_date DESC
      )
      FROM (
        SELECT 
          DATE(COALESCE(completed_at, created_at)) as batch_date,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
          SUM(amount) as total_amount,
          CASE 
            WHEN COUNT(*) > 0 THEN 
              (COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100
            ELSE 0
          END as success_rate,
          COALESCE(chain, 'ethereum') as chain
        FROM fee_collection_requests
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(COALESCE(completed_at, created_at)), chain
      ) batch_data
    ),
    'pending_requests', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'amount', amount,
          'asset', asset,
          'from_address', from_address,
          'chain', COALESCE(chain, 'ethereum'),
          'created_at', created_at,
          'transaction_id', transaction_id
        )
        ORDER BY created_at DESC
      )
      FROM fee_collection_requests
      WHERE status = 'pending'
      LIMIT 20
    ),
    'asset_breakdown', (
      SELECT json_object_agg(asset, amount_total)
      FROM (
        SELECT 
          asset,
          SUM(amount) as amount_total
        FROM fee_collection_requests
        WHERE status = 'pending'
        GROUP BY asset
      ) asset_data
    )
  ) INTO result;

  RETURN result;
END;
$$;