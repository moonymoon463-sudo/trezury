-- Create function to apply referral code during signup
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referee_id uuid,
  p_referral_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_referral_id uuid;
BEGIN
  -- Find referrer by code
  SELECT user_id INTO v_referrer_id
  FROM referral_codes
  WHERE code = UPPER(p_referral_code)
  AND is_active = true;
  
  -- Return error if code not found
  IF v_referrer_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid referral code'
    );
  END IF;
  
  -- Prevent self-referral
  IF v_referrer_id = p_referee_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot use your own referral code'
    );
  END IF;
  
  -- Create referral relationship
  INSERT INTO referrals (
    referrer_id,
    referee_id,
    status
  ) VALUES (
    v_referrer_id,
    p_referee_id,
    'pending'
  )
  RETURNING id INTO v_referral_id;
  
  -- Award signup bonus points to both users (2 points each)
  -- Referrer gets points
  INSERT INTO referral_points (
    user_id,
    points,
    source,
    event_type,
    related_referral_id,
    description
  ) VALUES (
    v_referrer_id,
    2,
    'referral_signup',
    'referee_signup',
    v_referral_id,
    'Bonus for referring a new user'
  );
  
  -- Referee gets points
  INSERT INTO referral_points (
    user_id,
    points,
    source,
    event_type,
    related_referral_id,
    description
  ) VALUES (
    p_referee_id,
    2,
    'referral_signup',
    'referrer_used',
    v_referral_id,
    'Bonus for using a referral code'
  );
  
  -- Update both balances
  INSERT INTO referral_point_balances (user_id, total_points)
  VALUES (v_referrer_id, 2)
  ON CONFLICT (user_id) 
  DO UPDATE SET total_points = referral_point_balances.total_points + 2;
  
  INSERT INTO referral_point_balances (user_id, total_points)
  VALUES (p_referee_id, 2)
  ON CONFLICT (user_id) 
  DO UPDATE SET total_points = referral_point_balances.total_points + 2;
  
  RETURN json_build_object(
    'success', true,
    'referral_id', v_referral_id,
    'points_awarded', 2
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;