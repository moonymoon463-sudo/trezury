-- Migration: Add TRZRY Airdrop Eligibility Tracking (Fixed)
-- Tracks when users first acquired TRZRY tokens for 6-month holding period requirement

-- Table to track first TRZRY acquisition for airdrop eligibility
CREATE TABLE public.trzry_holding_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_acquisition_date timestamptz NOT NULL,
  current_balance numeric NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.trzry_holding_tracker ENABLE ROW LEVEL SECURITY;

-- Users can view their own holding data
CREATE POLICY "Users can view own TRZRY holding tracker"
  ON public.trzry_holding_tracker
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- System can insert/update holding tracker
CREATE POLICY "Service role can manage TRZRY holding tracker"
  ON public.trzry_holding_tracker
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for efficient queries
CREATE INDEX idx_trzry_holding_user ON public.trzry_holding_tracker(user_id);

-- Function to calculate holding days and eligibility
CREATE OR REPLACE FUNCTION public.get_trzry_holding_status(p_user_id uuid)
RETURNS TABLE(
  holding_days integer,
  qualified_for_airdrop boolean,
  months_held numeric,
  progress_percentage numeric,
  days_remaining integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_date timestamptz;
  v_days integer;
BEGIN
  SELECT first_acquisition_date INTO v_first_date
  FROM trzry_holding_tracker
  WHERE user_id = p_user_id;
  
  IF v_first_date IS NULL THEN
    RETURN QUERY SELECT 0, false, 0::numeric, 0::numeric, 180;
    RETURN;
  END IF;
  
  v_days := EXTRACT(EPOCH FROM (now() - v_first_date))::integer / 86400;
  
  RETURN QUERY SELECT 
    v_days,
    v_days >= 180,
    (v_days::numeric / 30)::numeric,
    LEAST((v_days::numeric / 180 * 100)::numeric, 100),
    GREATEST(180 - v_days, 0);
END;
$$;

-- Function to update holding tracker when TRZRY transactions occur
CREATE OR REPLACE FUNCTION public.update_trzry_holding_tracker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only track TRZRY acquisitions (buys or receives)
  IF (NEW.output_asset = 'TRZRY' OR NEW.asset = 'TRZRY') 
     AND NEW.status = 'completed' THEN
    
    -- Insert or update holding tracker
    INSERT INTO public.trzry_holding_tracker (
      user_id,
      first_acquisition_date,
      current_balance,
      last_updated
    )
    VALUES (
      NEW.user_id,
      NEW.created_at,
      NEW.quantity,
      now()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
      current_balance = trzry_holding_tracker.current_balance + EXCLUDED.current_balance,
      last_updated = now()
    WHERE trzry_holding_tracker.user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to update tracker on transactions
CREATE TRIGGER trzry_holding_tracker_trigger
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trzry_holding_tracker();

-- Also update from balance snapshots for TRZRY
CREATE OR REPLACE FUNCTION public.sync_trzry_holding_from_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.asset = 'TRZRY' AND NEW.amount > 0 THEN
    INSERT INTO public.trzry_holding_tracker (
      user_id,
      first_acquisition_date,
      current_balance,
      last_updated
    )
    VALUES (
      NEW.user_id,
      NEW.snapshot_at,
      NEW.amount,
      now()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      last_updated = now();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trzry_snapshot_holding_trigger
  AFTER INSERT ON public.balance_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_trzry_holding_from_snapshots();

COMMENT ON TABLE public.trzry_holding_tracker IS 'Tracks when users first acquired TRZRY tokens for airdrop eligibility (6-month holding period requirement)';