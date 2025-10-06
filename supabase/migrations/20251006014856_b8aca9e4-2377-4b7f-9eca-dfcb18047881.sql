-- Fix search_path for prevent_wallet_deletion function
CREATE OR REPLACE FUNCTION prevent_wallet_deletion()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Wallets cannot be deleted, only archived. Use status=archived instead.';
END;
$$;

-- Fix search_path for log_wallet_changes function
CREATE OR REPLACE FUNCTION log_wallet_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO wallet_change_audit (user_id, new_address, change_type)
    VALUES (NEW.user_id, NEW.address, 'created');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO wallet_change_audit (
      user_id, old_address, new_address, change_type, 
      metadata
    ) VALUES (
      NEW.user_id, OLD.address, NEW.address, 
      NEW.status, 
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;