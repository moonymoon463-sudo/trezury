-- Priority 2: Alert System for Failed Reconciliations & Balance Mismatches

-- 1. Function to create alerts when balance mismatches are detected
CREATE OR REPLACE FUNCTION create_reconciliation_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alert_severity TEXT;
BEGIN
  -- Categorize severity based on difference amount
  IF ABS(NEW.difference) > 1000 THEN
    alert_severity := 'critical';
  ELSIF ABS(NEW.difference) > 100 THEN
    alert_severity := 'high';
  ELSIF ABS(NEW.difference) > 10 THEN
    alert_severity := 'medium';
  ELSE
    alert_severity := 'low';
  END IF;

  -- Create security alert
  INSERT INTO security_alerts (
    user_id,
    alert_type,
    severity,
    title,
    description,
    metadata
  ) VALUES (
    NEW.user_id,
    'balance_mismatch',
    alert_severity,
    'Balance Mismatch Detected',
    format('Balance mismatch of %s %s detected. DB: %s, Chain: %s', 
      NEW.difference, NEW.asset, NEW.db_balance, NEW.chain_balance),
    jsonb_build_object(
      'reconciliation_id', NEW.id,
      'asset', NEW.asset,
      'difference', NEW.difference,
      'address', NEW.address,
      'detected_at', NEW.detected_at
    )
  );

  RETURN NEW;
END;
$$;

-- Trigger on balance_reconciliations insertions
CREATE TRIGGER trigger_reconciliation_alert
AFTER INSERT ON balance_reconciliations
FOR EACH ROW
WHEN (NEW.status = 'pending_review')
EXECUTE FUNCTION create_reconciliation_alert();

-- 2. Function to monitor cron job health
CREATE OR REPLACE FUNCTION check_reconciliation_cron_health()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_active BOOLEAN;
  last_run_time TIMESTAMPTZ;
  failed_count INTEGER;
  pending_reconciliations INTEGER;
BEGIN
  -- Check if cron job is active
  SELECT active, MAX(r.end_time)
  INTO job_active, last_run_time
  FROM cron.job j
  LEFT JOIN cron.job_run_details r ON j.jobid = r.jobid
  WHERE j.jobname = 'reconcile-failed-transactions'
  GROUP BY j.active;

  -- Alert if job is inactive
  IF NOT COALESCE(job_active, FALSE) THEN
    INSERT INTO security_alerts (
      alert_type, severity, title, description, metadata
    ) VALUES (
      'cron_job_inactive',
      'critical',
      'Reconciliation Cron Job Inactive',
      'The automated reconciliation cron job is not active. Failed transactions will not be retried.',
      jsonb_build_object('job_name', 'reconcile-failed-transactions', 'checked_at', NOW())
    );
  END IF;

  -- Alert if last run was more than 10 minutes ago
  IF last_run_time IS NOT NULL AND last_run_time < (NOW() - INTERVAL '10 minutes') THEN
    INSERT INTO security_alerts (
      alert_type, severity, title, description, metadata
    ) VALUES (
      'cron_job_stale',
      'high',
      'Reconciliation Cron Job Not Running',
      format('Last successful run was at %s. Expected to run every 5 minutes.', last_run_time),
      jsonb_build_object('last_run', last_run_time, 'checked_at', NOW())
    );
  END IF;

  -- Check for high volume of pending reconciliations
  SELECT COUNT(*) INTO pending_reconciliations
  FROM failed_transaction_records
  WHERE reconciled = FALSE
    AND created_at > (NOW() - INTERVAL '1 hour');

  IF pending_reconciliations > 50 THEN
    INSERT INTO security_alerts (
      alert_type, severity, title, description, metadata
    ) VALUES (
      'high_pending_reconciliations',
      'high',
      'High Volume of Pending Reconciliations',
      format('%s failed transactions pending reconciliation in the last hour.', pending_reconciliations),
      jsonb_build_object('pending_count', pending_reconciliations, 'checked_at', NOW())
    );
  END IF;

  -- Check recent cron failures
  SELECT COUNT(*) INTO failed_count
  FROM cron.job_run_details
  WHERE jobname = 'reconcile-failed-transactions'
    AND start_time > (NOW() - INTERVAL '1 hour')
    AND status != 200;

  IF failed_count > 5 THEN
    INSERT INTO security_alerts (
      alert_type, severity, title, description, metadata
    ) VALUES (
      'cron_job_high_failure_rate',
      'critical',
      'High Reconciliation Cron Failure Rate',
      format('%s failures in the last hour. Check edge function logs.', failed_count),
      jsonb_build_object('failure_count', failed_count, 'checked_at', NOW())
    );
  END IF;
END;
$$;

-- Schedule health check every 15 minutes
SELECT cron.schedule(
  'reconciliation-health-check',
  '*/15 * * * *',
  $$SELECT check_reconciliation_cron_health();$$
);

-- 3. Admin dashboard view for reconciliation alerts
CREATE OR REPLACE VIEW reconciliation_alerts_summary AS
SELECT 
  alert_type,
  severity,
  COUNT(*) as alert_count,
  MAX(created_at) as latest_alert,
  jsonb_agg(
    jsonb_build_object(
      'id', id,
      'title', title,
      'created_at', created_at,
      'metadata', metadata
    ) ORDER BY created_at DESC
  ) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent_alerts
FROM security_alerts
WHERE alert_type IN (
  'balance_mismatch',
  'cron_job_inactive',
  'cron_job_stale',
  'high_pending_reconciliations',
  'cron_job_high_failure_rate'
)
  AND resolved_at IS NULL
GROUP BY alert_type, severity
ORDER BY 
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END;

-- 4. Admin function to retrieve reconciliation alerts
CREATE OR REPLACE FUNCTION get_reconciliation_alerts(limit_count INTEGER DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'alert_type', alert_type,
      'severity', severity,
      'title', title,
      'description', description,
      'created_at', created_at,
      'metadata', metadata
    ) ORDER BY created_at DESC
  )
  INTO result
  FROM security_alerts
  WHERE alert_type IN (
    'balance_mismatch',
    'cron_job_inactive',
    'cron_job_stale',
    'high_pending_reconciliations',
    'cron_job_high_failure_rate'
  )
    AND resolved_at IS NULL
  LIMIT limit_count;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;