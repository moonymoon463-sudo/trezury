-- Create balance_reconciliations table to track DB vs blockchain mismatches
CREATE TABLE IF NOT EXISTS public.balance_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  address TEXT NOT NULL,
  asset TEXT NOT NULL,
  db_balance NUMERIC NOT NULL,
  chain_balance NUMERIC NOT NULL,
  difference NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.balance_reconciliations ENABLE ROW LEVEL SECURITY;

-- Admin can view all reconciliations
CREATE POLICY "Admins can view all reconciliations"
  ON public.balance_reconciliations
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Admin can update reconciliations
CREATE POLICY "Admins can update reconciliations"
  ON public.balance_reconciliations
  FOR UPDATE
  USING (is_admin(auth.uid()));

-- Service role can insert reconciliations
CREATE POLICY "Service role can insert reconciliations"
  ON public.balance_reconciliations
  FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role');

-- Users can view their own reconciliations
CREATE POLICY "Users can view own reconciliations"
  ON public.balance_reconciliations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_balance_reconciliations_user_id ON public.balance_reconciliations(user_id);
CREATE INDEX idx_balance_reconciliations_status ON public.balance_reconciliations(status);
CREATE INDEX idx_balance_reconciliations_detected_at ON public.balance_reconciliations(detected_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_balance_reconciliations_updated_at
  BEFORE UPDATE ON public.balance_reconciliations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();