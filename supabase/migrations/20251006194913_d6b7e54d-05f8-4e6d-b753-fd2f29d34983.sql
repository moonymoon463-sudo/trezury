-- Create transaction_intents table for tracking swap attempts before blockchain execution
CREATE TABLE public.transaction_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  
  -- Swap details
  input_asset TEXT NOT NULL,
  output_asset TEXT NOT NULL,
  input_amount NUMERIC NOT NULL,
  expected_output_amount NUMERIC NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'initiated',
  -- Possible statuses:
  -- 'initiated' -> Intent created
  -- 'validating' -> Pre-flight validation in progress
  -- 'validation_failed' -> Pre-flight validation failed
  -- 'funds_pulled' -> User funds transferred to relayer
  -- 'swap_executed' -> On-chain swap completed
  -- 'disbursed' -> Tokens sent to user
  -- 'completed' -> All DB records created
  -- 'failed_refunded' -> Failed and funds returned to user
  -- 'partial_failure' -> Partial failure, needs manual review
  -- 'requires_reconciliation' -> Needs reconciliation
  
  -- Transaction hashes for audit trail
  pull_tx_hash TEXT,
  swap_tx_hash TEXT,
  disbursement_tx_hash TEXT,
  refund_tx_hash TEXT,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Metadata
  validation_data JSONB,
  blockchain_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  funds_pulled_at TIMESTAMPTZ,
  swap_executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX idx_transaction_intents_user_id ON public.transaction_intents(user_id);
CREATE INDEX idx_transaction_intents_status ON public.transaction_intents(status);
CREATE INDEX idx_transaction_intents_created_at ON public.transaction_intents(created_at DESC);
CREATE INDEX idx_transaction_intents_idempotency ON public.transaction_intents(idempotency_key);

-- Create index for reconciliation job (find stuck intents)
CREATE INDEX idx_transaction_intents_stuck ON public.transaction_intents(status, created_at) 
  WHERE status IN ('funds_pulled', 'swap_executed', 'validating');

-- Enable RLS
ALTER TABLE public.transaction_intents ENABLE ROW LEVEL SECURITY;

-- Users can view their own intents
CREATE POLICY "Users can view own transaction intents"
  ON public.transaction_intents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all intents
CREATE POLICY "Service role can manage transaction intents"
  ON public.transaction_intents
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- Admins can view all intents
CREATE POLICY "Admins can view all transaction intents"
  ON public.transaction_intents
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_transaction_intents_updated_at
  BEFORE UPDATE ON public.transaction_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();