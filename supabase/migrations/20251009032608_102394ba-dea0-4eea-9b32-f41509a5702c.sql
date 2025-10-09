-- ============================================================================
-- REFERRAL SYSTEM - PHASE 2: SCHEDULED JOBS & AUTOMATION
-- ============================================================================

-- ============================================================================
-- 1. CHECK 180-DAY TRZRY HOLDING MILESTONES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_180_day_milestones()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_points_awarded INTEGER := 0;
  v_result JSON;
BEGIN
  -- Find all users who have held TRZRY for 180+ days and haven't received the bonus
  WITH eligible_users AS (
    SELECT 
      tht.user_id,
      tht.first_acquisition_date,
      EXTRACT(EPOCH FROM (now() - tht.first_acquisition_date))::INTEGER / 86400 as holding_days
    FROM trzry_holding_tracker tht
    WHERE tht.current_balance > 0
      AND EXTRACT(EPOCH FROM (now() - tht.first_acquisition_date))::INTEGER / 86400 >= 180
  ),
  referrals_to_reward AS (
    SELECT 
      r.id as referral_id,
      r.referrer_id,
      r.referee_id,
      eu.holding_days
    FROM eligible_users eu
    JOIN referrals r ON r.referee_id = eu.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM referral_points rp
      WHERE rp.user_id = r.referrer_id
        AND rp.event_type = '180_day_milestone'
        AND rp.related_referral_id = r.id
    )
  )
  INSERT INTO referral_points (
    user_id, points, event_type, related_referral_id, description, metadata
  )
  SELECT
    referrer_id,
    10,
    '180_day_milestone',
    referral_id,
    format('Referral held TRZRY for 180+ days (%s days)', holding_days),
    jsonb_build_object(
      'holding_days', holding_days,
      'awarded_at', now(),
      'automated', true
    )
  FROM referrals_to_reward
  RETURNING 1;

  GET DIAGNOSTICS v_processed_count = ROW_COUNT;
  v_points_awarded := v_processed_count * 10;

  -- Update referral point balances
  WITH awarded_referrers AS (
    SELECT DISTINCT user_id
    FROM referral_points
    WHERE event_type = '180_day_milestone'
      AND created_at > now() - INTERVAL '1 minute'
  )
  UPDATE referral_point_balances rpb
  SET 
    total_points = rpb.total_points + 10,
    lifetime_earned = rpb.lifetime_earned + 10,
    last_updated = now()
  WHERE user_id IN (SELECT user_id FROM awarded_referrers);

  -- Build result
  SELECT json_build_object(
    'success', true,
    'processed_count', v_processed_count,
    'total_points_awarded', v_points_awarded,
    'timestamp', now()
  ) INTO v_result;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'timestamp', now()
  );
END;
$$;

-- ============================================================================
-- 2. AWARD MONTHLY ACTIVE USER POINTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.award_monthly_active_points()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_points_awarded INTEGER := 0;
  v_last_month_start DATE;
  v_last_month_end DATE;
  v_period_key TEXT;
  v_result JSON;
BEGIN
  -- Calculate last month's date range
  v_last_month_start := date_trunc('month', current_date - INTERVAL '1 month')::DATE;
  v_last_month_end := (date_trunc('month', current_date) - INTERVAL '1 day')::DATE;
  v_period_key := to_char(v_last_month_start, 'YYYY-MM');

  -- Find active referees (completed trades last month) and award their referrers
  WITH active_referees AS (
    SELECT DISTINCT
      t.user_id as referee_id
    FROM transactions t
    WHERE t.status = 'completed'
      AND t.created_at::DATE BETWEEN v_last_month_start AND v_last_month_end
      AND t.type IN ('buy', 'sell', 'swap')
  ),
  referrers_to_reward AS (
    SELECT 
      r.referrer_id,
      r.id as referral_id,
      ar.referee_id,
      COUNT(*) as active_referee_count
    FROM active_referees ar
    JOIN referrals r ON r.referee_id = ar.referee_id
    WHERE r.status IN ('pending', 'completed', 'credited')
      AND NOT EXISTS (
        SELECT 1 FROM referral_points rp
        WHERE rp.user_id = r.referrer_id
          AND rp.event_type = 'monthly_active'
          AND rp.related_referral_id = r.id
          AND rp.metadata->>'period' = v_period_key
      )
    GROUP BY r.referrer_id, r.id, ar.referee_id
  )
  INSERT INTO referral_points (
    user_id, points, event_type, related_referral_id, description, metadata
  )
  SELECT
    referrer_id,
    5,
    'monthly_active',
    referral_id,
    format('Active referral bonus for %s', v_period_key),
    jsonb_build_object(
      'period', v_period_key,
      'period_start', v_last_month_start,
      'period_end', v_last_month_end,
      'awarded_at', now(),
      'automated', true
    )
  FROM referrers_to_reward
  RETURNING 1;

  GET DIAGNOSTICS v_processed_count = ROW_COUNT;
  v_points_awarded := v_processed_count * 5;

  -- Update referral point balances
  WITH awarded_referrers AS (
    SELECT DISTINCT user_id
    FROM referral_points
    WHERE event_type = 'monthly_active'
      AND created_at > now() - INTERVAL '1 minute'
  )
  UPDATE referral_point_balances rpb
  SET 
    total_points = rpb.total_points + 5,
    lifetime_earned = rpb.lifetime_earned + 5,
    last_updated = now()
  WHERE user_id IN (SELECT user_id FROM awarded_referrers);

  -- Build result
  SELECT json_build_object(
    'success', true,
    'period', v_period_key,
    'processed_count', v_processed_count,
    'total_points_awarded', v_points_awarded,
    'timestamp', now()
  ) INTO v_result;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'period', v_period_key,
    'timestamp', now()
  );
END;
$$;

-- ============================================================================
-- 3. AUTO-ACTIVATE AIRDROP PERIODS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_activate_airdrop_periods()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activated_count INTEGER := 0;
  v_result JSON;
BEGIN
  -- Activate airdrop periods that have reached their start date
  WITH activated_periods AS (
    UPDATE airdrop_periods
    SET 
      status = 'active',
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{auto_activated_at}',
        to_jsonb(now())
      )
    WHERE status = 'upcoming'
      AND start_date <= current_date
    RETURNING id, period_name, start_date
  )
  SELECT COUNT(*) INTO v_activated_count FROM activated_periods;

  -- Build result with details
  SELECT json_build_object(
    'success', true,
    'activated_count', v_activated_count,
    'activated_periods', (
      SELECT json_agg(json_build_object(
        'id', id,
        'period_name', period_name,
        'start_date', start_date
      ))
      FROM (
        SELECT id, period_name, start_date
        FROM airdrop_periods
        WHERE status = 'active'
          AND metadata->>'auto_activated_at' IS NOT NULL
          AND (metadata->>'auto_activated_at')::TIMESTAMPTZ > now() - INTERVAL '1 minute'
      ) recent_activations
    ),
    'timestamp', now()
  ) INTO v_result;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'timestamp', now()
  );
END;
$$;

-- ============================================================================
-- 4. SCHEDULE CRON JOBS
-- ============================================================================

-- Job 1: Check 180-day milestones daily at 2 AM UTC
SELECT cron.schedule(
  'referral-180-day-milestone',
  '0 2 * * *',
  $$
  SELECT public.check_180_day_milestones();
  $$
);

-- Job 2: Award monthly active user points on 1st of each month at 3 AM UTC
SELECT cron.schedule(
  'referral-monthly-active',
  '0 3 1 * *',
  $$
  SELECT public.award_monthly_active_points();
  $$
);

-- Job 3: Auto-activate airdrop periods daily at midnight UTC
SELECT cron.schedule(
  'airdrop-period-activation',
  '0 0 * * *',
  $$
  SELECT public.auto_activate_airdrop_periods();
  $$
);

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.check_180_day_milestones() TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_monthly_active_points() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_activate_airdrop_periods() TO authenticated;