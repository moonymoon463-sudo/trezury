-- ============================================================================
-- REFERRAL SYSTEM - PHASE 1: DATABASE FOUNDATION
-- ============================================================================

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- A. referral_codes: Stores unique referral codes for each user
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT unique_user_referral UNIQUE(user_id)
);

CREATE INDEX idx_referral_codes_user ON public.referral_codes(user_id);
CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);

-- B. referrals: Tracks referral relationships and status
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  completion_type TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT unique_referral UNIQUE(referee_id),
  CONSTRAINT no_self_referral CHECK (referrer_id != referee_id)
);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_referee ON public.referrals(referee_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);
CREATE INDEX idx_referrals_code ON public.referrals(referral_code);

-- C. referral_points: Ledger for all point transactions
CREATE TABLE IF NOT EXISTS public.referral_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  related_referral_id UUID REFERENCES public.referrals(id),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_referral_points_user ON public.referral_points(user_id);
CREATE INDEX idx_referral_points_type ON public.referral_points(event_type);
CREATE INDEX idx_referral_points_created ON public.referral_points(created_at DESC);

-- D. referral_point_balances: Materialized view for current point totals
CREATE TABLE IF NOT EXISTS public.referral_point_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  points_redeemed INTEGER NOT NULL DEFAULT 0,
  current_tier TEXT DEFAULT 'bronze',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_balances_points ON public.referral_point_balances(total_points DESC);
CREATE INDEX idx_referral_balances_tier ON public.referral_point_balances(current_tier);

-- E. airdrop_periods: Defines airdrop distribution periods and pool sizes
CREATE TABLE IF NOT EXISTS public.airdrop_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  total_pool_size NUMERIC NOT NULL,
  points_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'upcoming',
  distribution_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_airdrop_periods_status ON public.airdrop_periods(status);
CREATE INDEX idx_airdrop_periods_dates ON public.airdrop_periods(start_date, end_date);

-- F. airdrop_allocations: Stores calculated airdrop amounts per user per period
CREATE TABLE IF NOT EXISTS public.airdrop_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airdrop_period_id UUID NOT NULL REFERENCES public.airdrop_periods(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_snapshot INTEGER NOT NULL,
  allocation_percentage NUMERIC NOT NULL,
  trzry_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  distributed_at TIMESTAMPTZ,
  transaction_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_period UNIQUE(user_id, airdrop_period_id)
);

CREATE INDEX idx_allocations_period ON public.airdrop_allocations(airdrop_period_id);
CREATE INDEX idx_allocations_user ON public.airdrop_allocations(user_id);
CREATE INDEX idx_allocations_status ON public.airdrop_allocations(status);

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_point_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airdrop_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airdrop_allocations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CREATE RLS POLICIES
-- ============================================================================

-- referral_codes policies
CREATE POLICY "Users can view their own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own referral code"
  ON public.referral_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages referral codes"
  ON public.referral_codes FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- referrals policies
CREATE POLICY "Users can view referrals they are part of"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

CREATE POLICY "Service role manages referrals"
  ON public.referrals FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Admins can view all referrals"
  ON public.referrals FOR SELECT
  USING (is_admin(auth.uid()));

-- referral_points policies
CREATE POLICY "Users can view their own points history"
  ON public.referral_points FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages points"
  ON public.referral_points FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Admins can view all points"
  ON public.referral_points FOR SELECT
  USING (is_admin(auth.uid()));

-- referral_point_balances policies
CREATE POLICY "Users can view their own balance"
  ON public.referral_point_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages balances"
  ON public.referral_point_balances FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Admins can view all balances"
  ON public.referral_point_balances FOR SELECT
  USING (is_admin(auth.uid()));

-- airdrop_periods policies (Public read, admin write)
CREATE POLICY "Anyone can view airdrop periods"
  ON public.airdrop_periods FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage airdrop periods"
  ON public.airdrop_periods FOR ALL
  USING (is_admin(auth.uid()));

-- airdrop_allocations policies
CREATE POLICY "Users can view their own allocations"
  ON public.airdrop_allocations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage allocations"
  ON public.airdrop_allocations FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Service role manages allocations"
  ON public.airdrop_allocations FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- ============================================================================
-- 4. CORE FUNCTIONS
-- ============================================================================

-- A. Generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    new_code := UPPER(
      substring(md5(random()::text || clock_timestamp()::text) from 1 for 8)
    );
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- B. Award referral points
CREATE OR REPLACE FUNCTION public.award_referral_points(
  p_referrer_id UUID,
  p_points INTEGER,
  p_event_type TEXT,
  p_referral_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert point transaction
  INSERT INTO public.referral_points (
    user_id, points, event_type, related_referral_id, description
  ) VALUES (
    p_referrer_id, p_points, p_event_type, p_referral_id, p_description
  );
  
  -- Update balance (upsert)
  INSERT INTO public.referral_point_balances (user_id, total_points, lifetime_earned)
  VALUES (p_referrer_id, p_points, p_points)
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = referral_point_balances.total_points + EXCLUDED.total_points,
    lifetime_earned = referral_point_balances.lifetime_earned + EXCLUDED.lifetime_earned,
    last_updated = now();
    
  -- Update tier based on lifetime points
  UPDATE public.referral_point_balances
  SET current_tier = CASE
    WHEN lifetime_earned >= 1000 THEN 'platinum'
    WHEN lifetime_earned >= 500 THEN 'gold'
    WHEN lifetime_earned >= 200 THEN 'silver'
    ELSE 'bronze'
  END
  WHERE user_id = p_referrer_id;
  
  -- Send notification to referrer
  INSERT INTO notifications (user_id, title, body, kind, icon, priority)
  VALUES (
    p_referrer_id,
    'Referral Points Earned! 🎉',
    format('You earned %s points! %s', p_points, COALESCE(p_description, '')),
    'reward',
    '🎁',
    'info'
  );
END;
$$;

-- C. Validate and apply referral code
CREATE OR REPLACE FUNCTION public.validate_and_apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_id UUID;
  v_code_exists BOOLEAN;
BEGIN
  -- Validate code exists and is active
  SELECT user_id INTO v_referrer_id
  FROM referral_codes
  WHERE code = UPPER(p_referral_code) AND is_active = true;
  
  IF v_referrer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Prevent self-referral
  IF v_referrer_id = p_referee_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Check if user already used a referral code
  SELECT EXISTS(SELECT 1 FROM referrals WHERE referee_id = p_referee_id) INTO v_code_exists;
  IF v_code_exists THEN
    RETURN json_build_object('success', false, 'error', 'Referral code already used');
  END IF;
  
  -- Create referral record
  INSERT INTO public.referrals (referrer_id, referee_id, referral_code, status)
  VALUES (v_referrer_id, p_referee_id, UPPER(p_referral_code), 'pending')
  RETURNING id INTO v_referral_id;
  
  -- Award 2 points immediately for signup
  PERFORM award_referral_points(
    v_referrer_id,
    2,
    'referral_signup',
    v_referral_id,
    'New referral signed up'
  );
  
  RETURN json_build_object(
    'success', true,
    'referral_id', v_referral_id,
    'referrer_id', v_referrer_id
  );
END;
$$;

-- D. Get user referral stats
CREATE OR REPLACE FUNCTION public.get_user_referral_stats(p_user_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  SELECT json_build_object(
    'referral_code', (SELECT code FROM referral_codes WHERE user_id = v_user_id),
    'total_referrals', (SELECT COUNT(*) FROM referrals WHERE referrer_id = v_user_id),
    'completed_referrals', (SELECT COUNT(*) FROM referrals WHERE referrer_id = v_user_id AND status IN ('completed', 'credited')),
    'pending_referrals', (SELECT COUNT(*) FROM referrals WHERE referrer_id = v_user_id AND status = 'pending'),
    'total_points', COALESCE((SELECT total_points FROM referral_point_balances WHERE user_id = v_user_id), 0),
    'lifetime_earned', COALESCE((SELECT lifetime_earned FROM referral_point_balances WHERE user_id = v_user_id), 0),
    'current_tier', COALESCE((SELECT current_tier FROM referral_point_balances WHERE user_id = v_user_id), 'bronze'),
    'recent_referrals', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', r.id,
        'referee_email', p.email,
        'status', r.status,
        'completion_type', r.completion_type,
        'created_at', r.created_at,
        'completed_at', r.completed_at
      ) ORDER BY r.created_at DESC), '[]'::json)
      FROM referrals r
      JOIN profiles p ON r.referee_id = p.id
      WHERE r.referrer_id = v_user_id
      LIMIT 10
    ),
    'points_history', (
      SELECT COALESCE(json_agg(json_build_object(
        'points', points,
        'event_type', event_type,
        'description', description,
        'created_at', created_at
      ) ORDER BY created_at DESC), '[]'::json)
      FROM referral_points
      WHERE user_id = v_user_id
      LIMIT 20
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- A. Auto-create referral code on profile creation
CREATE OR REPLACE FUNCTION public.create_user_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
BEGIN
  -- Generate unique code
  new_code := generate_referral_code();
  
  -- Insert referral code
  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.id, new_code);
  
  -- Initialize point balance
  INSERT INTO public.referral_point_balances (user_id, total_points, lifetime_earned)
  VALUES (NEW.id, 0, 0);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_referral_code_on_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_referral_code();

-- B. Award points on KYC completion (5 points)
CREATE OR REPLACE FUNCTION public.check_and_award_kyc_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_record RECORD;
BEGIN
  -- Only process when KYC status changes to verified
  IF NEW.kyc_status = 'verified' AND OLD.kyc_status != 'verified' THEN
    -- Find if user was referred
    SELECT * INTO v_referral_record
    FROM referrals
    WHERE referee_id = NEW.id;
    
    IF FOUND THEN
      -- Award 5 points to referrer
      PERFORM award_referral_points(
        v_referral_record.referrer_id,
        5,
        'kyc_completion',
        v_referral_record.id,
        'Referral completed KYC verification'
      );
      
      -- Update referral status
      UPDATE referrals
      SET completion_type = 'kyc_verified',
          metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{kyc_completed}', 'true')
      WHERE id = v_referral_record.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER award_points_kyc_completion
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.kyc_status = 'verified' AND OLD.kyc_status IS DISTINCT FROM 'verified')
  EXECUTE FUNCTION check_and_award_kyc_points();

-- C. Award points on first trade ($25+) - 10 points
CREATE OR REPLACE FUNCTION public.check_and_award_first_trade_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_record RECORD;
  v_is_first_trade BOOLEAN;
  v_trade_value NUMERIC;
BEGIN
  -- Only process completed transactions
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;
  
  -- Calculate trade value
  v_trade_value := NEW.quantity * COALESCE(NEW.unit_price_usd, 0);
  
  -- Must be $25 or more
  IF v_trade_value < 25 THEN
    RETURN NEW;
  END IF;
  
  -- Check if this is user's first completed trade
  SELECT COUNT(*) = 1 INTO v_is_first_trade
  FROM transactions
  WHERE user_id = NEW.user_id AND status = 'completed';
  
  IF NOT v_is_first_trade THEN
    RETURN NEW;
  END IF;
  
  -- Find if user was referred
  SELECT * INTO v_referral_record
  FROM referrals
  WHERE referee_id = NEW.user_id;
  
  IF FOUND THEN
    -- Award 10 points to referrer
    PERFORM award_referral_points(
      v_referral_record.referrer_id,
      10,
      'first_trade',
      v_referral_record.id,
      format('Referral completed first trade ($%.2f)', v_trade_value)
    );
    
    -- Update referral status
    UPDATE referrals
    SET status = 'completed',
        completion_type = 'first_trade',
        completed_at = now(),
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{first_trade_value}', to_jsonb(v_trade_value))
    WHERE id = v_referral_record.id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER award_points_first_trade
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION check_and_award_first_trade_points();

-- D. Award points on TRZRY purchase - 15 points (first time only)
CREATE OR REPLACE FUNCTION public.check_and_award_trzry_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_record RECORD;
  v_is_first_trzry BOOLEAN;
  v_already_awarded BOOLEAN;
BEGIN
  -- Only process completed TRZRY purchases
  IF NEW.status != 'completed' OR NEW.output_asset != 'TRZRY' THEN
    RETURN NEW;
  END IF;
  
  -- Check if this is user's first TRZRY purchase
  SELECT COUNT(*) = 1 INTO v_is_first_trzry
  FROM transactions
  WHERE user_id = NEW.user_id 
    AND status = 'completed' 
    AND output_asset = 'TRZRY';
  
  IF NOT v_is_first_trzry THEN
    RETURN NEW;
  END IF;
  
  -- Find if user was referred
  SELECT * INTO v_referral_record
  FROM referrals
  WHERE referee_id = NEW.user_id;
  
  IF FOUND THEN
    -- Check if bonus already awarded
    SELECT EXISTS(
      SELECT 1 FROM referral_points 
      WHERE user_id = v_referral_record.referrer_id 
        AND event_type = 'trzry_purchase'
        AND related_referral_id = v_referral_record.id
    ) INTO v_already_awarded;
    
    IF NOT v_already_awarded THEN
      -- Award 15 points to referrer
      PERFORM award_referral_points(
        v_referral_record.referrer_id,
        15,
        'trzry_purchase',
        v_referral_record.id,
        'Referral purchased TRZRY tokens'
      );
      
      -- Update referral metadata
      UPDATE referrals
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{trzry_purchased}', 'true')
      WHERE id = v_referral_record.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER award_points_trzry_purchase
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND NEW.output_asset = 'TRZRY')
  EXECUTE FUNCTION check_and_award_trzry_bonus();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;