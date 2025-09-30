-- Create user transaction limits table with tier-based controls
CREATE TABLE IF NOT EXISTS public.user_transaction_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard', 'premium', 'institutional')),
  
  -- Transaction amount limits (USD)
  single_transaction_max NUMERIC NOT NULL DEFAULT 10000,
  daily_transaction_max NUMERIC NOT NULL DEFAULT 50000,
  monthly_transaction_max NUMERIC NOT NULL DEFAULT 200000,
  
  -- Velocity limits
  max_transactions_per_hour INTEGER NOT NULL DEFAULT 10,
  max_transactions_per_day INTEGER NOT NULL DEFAULT 50,
  
  -- Large transaction confirmation threshold
  confirmation_threshold NUMERIC NOT NULL DEFAULT 5000,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_transaction_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own limits
CREATE POLICY "Users can view their own transaction limits"
ON public.user_transaction_limits
FOR SELECT
USING (auth.uid() = user_id);

-- Only admins can modify limits
CREATE POLICY "Admins can manage transaction limits"
ON public.user_transaction_limits
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Create function to check transaction velocity
CREATE OR REPLACE FUNCTION public.check_transaction_velocity(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_hourly_count INTEGER;
  v_daily_count INTEGER;
  v_daily_total NUMERIC;
  v_monthly_total NUMERIC;
  v_result JSON;
BEGIN
  -- Get user's limits
  SELECT * INTO v_limits
  FROM user_transaction_limits
  WHERE user_id = p_user_id;
  
  -- If no limits exist, create default standard tier
  IF NOT FOUND THEN
    INSERT INTO user_transaction_limits (user_id, tier)
    VALUES (p_user_id, 'standard')
    RETURNING * INTO v_limits;
  END IF;
  
  -- Check single transaction limit
  IF p_amount > v_limits.single_transaction_max THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'single_transaction_limit_exceeded',
      'limit', v_limits.single_transaction_max,
      'requested', p_amount
    );
  END IF;
  
  -- Check hourly velocity
  SELECT COUNT(*) INTO v_hourly_count
  FROM transactions
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '1 hour'
    AND status = 'completed';
  
  IF v_hourly_count >= v_limits.max_transactions_per_hour THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'hourly_velocity_exceeded',
      'limit', v_limits.max_transactions_per_hour,
      'current', v_hourly_count
    );
  END IF;
  
  -- Check daily velocity
  SELECT COUNT(*) INTO v_daily_count
  FROM transactions
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '1 day'
    AND status = 'completed';
  
  IF v_daily_count >= v_limits.max_transactions_per_day THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'daily_velocity_exceeded',
      'limit', v_limits.max_transactions_per_day,
      'current', v_daily_count
    );
  END IF;
  
  -- Check daily total amount
  SELECT COALESCE(SUM(quantity * unit_price_usd), 0) INTO v_daily_total
  FROM transactions
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '1 day'
    AND status = 'completed';
  
  IF (v_daily_total + p_amount) > v_limits.daily_transaction_max THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'daily_amount_exceeded',
      'limit', v_limits.daily_transaction_max,
      'current', v_daily_total,
      'requested', p_amount
    );
  END IF;
  
  -- Check monthly total amount
  SELECT COALESCE(SUM(quantity * unit_price_usd), 0) INTO v_monthly_total
  FROM transactions
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '30 days'
    AND status = 'completed';
  
  IF (v_monthly_total + p_amount) > v_limits.monthly_transaction_max THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'monthly_amount_exceeded',
      'limit', v_limits.monthly_transaction_max,
      'current', v_monthly_total,
      'requested', p_amount
    );
  END IF;
  
  -- All checks passed
  RETURN json_build_object(
    'allowed', true,
    'requires_confirmation', p_amount >= v_limits.confirmation_threshold,
    'limits', json_build_object(
      'tier', v_limits.tier,
      'single_max', v_limits.single_transaction_max,
      'daily_remaining', v_limits.daily_transaction_max - v_daily_total,
      'monthly_remaining', v_limits.monthly_transaction_max - v_monthly_total
    )
  );
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_user_transaction_limits_updated_at
  BEFORE UPDATE ON public.user_transaction_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_user_transaction_limits_user_id ON public.user_transaction_limits(user_id);
CREATE INDEX idx_transactions_velocity_check ON public.transactions(user_id, created_at, status);