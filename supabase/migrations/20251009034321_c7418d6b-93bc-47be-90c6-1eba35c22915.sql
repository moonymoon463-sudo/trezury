-- Fix referral code generation trigger and backfill missing codes

-- First, ensure the trigger function exists and is correct
CREATE OR REPLACE FUNCTION public.create_referral_code_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Generate a unique 8-character referral code
  LOOP
    new_code := upper(substring(md5(random()::text || NEW.id::text) from 1 for 8));
    
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  -- Insert the referral code
  INSERT INTO referral_codes (user_id, code)
  VALUES (NEW.id, new_code);
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger to ensure it's active
DROP TRIGGER IF EXISTS create_referral_code_trigger ON profiles;
CREATE TRIGGER create_referral_code_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_referral_code_on_signup();

-- Function to backfill missing referral codes
CREATE OR REPLACE FUNCTION public.backfill_missing_referral_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Loop through all users without referral codes
  FOR user_record IN 
    SELECT p.id 
    FROM profiles p
    LEFT JOIN referral_codes rc ON p.id = rc.user_id
    WHERE rc.code IS NULL
  LOOP
    -- Generate unique code for each user
    LOOP
      new_code := upper(substring(md5(random()::text || user_record.id::text) from 1 for 8));
      
      SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    
    -- Insert the referral code
    INSERT INTO referral_codes (user_id, code)
    VALUES (user_record.id, new_code);
  END LOOP;
END;
$$;

-- Execute the backfill function
SELECT backfill_missing_referral_codes();

-- Initialize point balances for users who don't have them
INSERT INTO referral_point_balances (user_id, total_points)
SELECT p.id, 0
FROM profiles p
LEFT JOIN referral_point_balances rpb ON p.id = rpb.user_id
WHERE rpb.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;