-- Create profile update notification function and trigger
CREATE OR REPLACE FUNCTION public.notify_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_changes text[] := ARRAY[]::text[];
  v_change_summary text;
BEGIN
  -- Detect which fields changed
  IF OLD.phone IS DISTINCT FROM NEW.phone THEN
    v_changes := array_append(v_changes, 'phone number');
  END IF;
  
  IF OLD.address IS DISTINCT FROM NEW.address THEN
    v_changes := array_append(v_changes, 'address');
  END IF;
  
  IF OLD.first_name IS DISTINCT FROM NEW.first_name OR OLD.last_name IS DISTINCT FROM NEW.last_name THEN
    v_changes := array_append(v_changes, 'name');
  END IF;
  
  IF OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth THEN
    v_changes := array_append(v_changes, 'date of birth');
  END IF;
  
  -- Only create notification if something actually changed
  IF array_length(v_changes, 1) > 0 THEN
    -- Build change summary
    v_change_summary := array_to_string(v_changes, ', ');
    
    INSERT INTO notifications (user_id, title, body, kind, priority)
    VALUES (
      NEW.id,
      'Profile Updated',
      'Your profile information (' || v_change_summary || ') has been successfully updated.',
      'profile_updated',
      'info'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for profile updates
DROP TRIGGER IF EXISTS profile_update_notification ON profiles;
CREATE TRIGGER profile_update_notification
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION notify_profile_update();

-- Create wallet setup notification function
CREATE OR REPLACE FUNCTION public.notify_wallet_setup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Notify when first wallet address is created
  IF NOT EXISTS (
    SELECT 1 FROM onchain_addresses 
    WHERE user_id = NEW.user_id 
    AND id != NEW.id
  ) THEN
    INSERT INTO notifications (user_id, title, body, kind, priority)
    VALUES (
      NEW.user_id,
      'Wallet Setup Complete',
      'Your secure wallet has been set up successfully! You can now manage your assets.',
      'wallet_setup_complete',
      'info'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for wallet setup
DROP TRIGGER IF EXISTS wallet_setup_notification ON onchain_addresses;
CREATE TRIGGER wallet_setup_notification
AFTER INSERT ON onchain_addresses
FOR EACH ROW
EXECUTE FUNCTION notify_wallet_setup();