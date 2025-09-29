-- Fix RLS security warnings for new scaling tables

-- Enable RLS on performance_metrics table
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- Admin-only access to performance metrics
CREATE POLICY "Admin only access to performance metrics" 
ON performance_metrics 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Enable RLS on system_capacity table  
ALTER TABLE system_capacity ENABLE ROW LEVEL SECURITY;

-- Admin-only access to system capacity
CREATE POLICY "Admin only access to system capacity" 
ON system_capacity 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Function to get system health metrics for 10k users
CREATE OR REPLACE FUNCTION get_system_health_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  active_users INTEGER;
  total_transactions INTEGER;
  avg_response_time NUMERIC;
BEGIN
  -- Get active users (users with activity in last 5 minutes)
  SELECT COUNT(DISTINCT user_id) INTO active_users
  FROM audit_log 
  WHERE timestamp > now() - interval '5 minutes';
  
  -- Get total completed transactions
  SELECT COUNT(*) INTO total_transactions
  FROM transactions 
  WHERE status = 'completed';
  
  -- Get average response time from recent performance metrics
  SELECT AVG(metric_value) INTO avg_response_time
  FROM performance_metrics 
  WHERE metric_name = 'api_response_time_ms' 
    AND recorded_at > now() - interval '1 hour';
  
  SELECT json_build_object(
    'active_users', COALESCE(active_users, 0),
    'total_users', (SELECT COUNT(*) FROM profiles),
    'total_transactions', COALESCE(total_transactions, 0),
    'avg_response_time_ms', COALESCE(avg_response_time, 0),
    'system_load', CASE 
      WHEN active_users > 1000 THEN 'high'
      WHEN active_users > 500 THEN 'medium'
      ELSE 'low'
    END,
    'capacity_status', CASE 
      WHEN active_users > 8000 THEN 'critical'
      WHEN active_users > 5000 THEN 'warning'
      ELSE 'healthy'
    END,
    'timestamp', now()
  ) INTO result;
  
  RETURN result;
END;
$$;