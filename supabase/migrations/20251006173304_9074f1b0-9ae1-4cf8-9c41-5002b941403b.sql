-- Create failed_transaction_records table for reconciliation
CREATE TABLE IF NOT EXISTS failed_transaction_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  tx_hash TEXT NOT NULL,
  quote_id UUID,
  swap_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  error_message TEXT
);

-- Create index for faster lookups
CREATE INDEX idx_failed_tx_reconciled ON failed_transaction_records(reconciled) WHERE reconciled = FALSE;
CREATE INDEX idx_failed_tx_user_id ON failed_transaction_records(user_id);

-- Create swap_execution_metrics table for monitoring
CREATE TABLE IF NOT EXISTS swap_execution_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  on_chain_success BOOLEAN NOT NULL,
  db_record_success BOOLEAN NOT NULL,
  fee_collection_success BOOLEAN NOT NULL,
  retry_count INTEGER DEFAULT 0,
  error_type TEXT,
  user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for metrics analysis
CREATE INDEX idx_swap_metrics_recorded_at ON swap_execution_metrics(recorded_at DESC);
CREATE INDEX idx_swap_metrics_failures ON swap_execution_metrics(db_record_success) WHERE db_record_success = FALSE;

-- Enable RLS on new tables
ALTER TABLE failed_transaction_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE swap_execution_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies for failed_transaction_records
CREATE POLICY "Users can view own failed transaction records"
  ON failed_transaction_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage failed transaction records"
  ON failed_transaction_records FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS policies for swap_execution_metrics
CREATE POLICY "Admins can view swap metrics"
  ON swap_execution_metrics FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Service role can insert swap metrics"
  ON swap_execution_metrics FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);