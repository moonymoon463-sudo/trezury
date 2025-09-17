-- Create lock status enum
CREATE TYPE lock_status AS ENUM ('active', 'matured', 'exited_early');

-- Create locks table
CREATE TABLE public.locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  chain TEXT NOT NULL,
  token TEXT NOT NULL,
  amount_dec NUMERIC(38, 6) NOT NULL,
  apy_min NUMERIC(5,2) NOT NULL,
  apy_max NUMERIC(5,2) NOT NULL,
  apy_applied NUMERIC(5,2) NOT NULL,
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  status lock_status NOT NULL DEFAULT 'active',
  accrued_interest_dec NUMERIC(38, 6) NOT NULL DEFAULT 0,
  autocompound BOOLEAN NOT NULL DEFAULT false,
  deposit_tx TEXT,
  withdraw_tx TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create pool stats table
CREATE TABLE public.pool_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain TEXT NOT NULL,
  token TEXT NOT NULL,
  total_deposits_dec NUMERIC(38, 6) NOT NULL DEFAULT 0,
  total_borrowed_dec NUMERIC(38, 6) NOT NULL DEFAULT 0,
  utilization_fp NUMERIC(10,6) NOT NULL DEFAULT 0,
  reserve_balance_dec NUMERIC(38, 6) NOT NULL DEFAULT 0,
  updated_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chain, token)
);

-- Create payouts table
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_id UUID REFERENCES public.locks(id),
  principal_dec NUMERIC(38, 6) NOT NULL,
  interest_dec NUMERIC(38, 6) NOT NULL,
  chain TEXT NOT NULL,
  token TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  tx_hash TEXT
);

-- Enable RLS on all tables
ALTER TABLE public.locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for locks
CREATE POLICY "Users can view their own locks" ON public.locks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own locks" ON public.locks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own locks" ON public.locks
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for pool_stats (public read, system write)
CREATE POLICY "Anyone can view pool stats" ON public.pool_stats
  FOR SELECT USING (true);

CREATE POLICY "System can update pool stats" ON public.pool_stats
  FOR ALL USING (true);

-- RLS policies for payouts
CREATE POLICY "Users can view their own payouts" ON public.payouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.locks 
      WHERE locks.id = payouts.lock_id 
      AND locks.user_id = auth.uid()
    )
  );

CREATE POLICY "System can create payouts" ON public.payouts
  FOR INSERT WITH CHECK (true);

-- Add triggers for updated_at
CREATE TRIGGER update_locks_updated_at
  BEFORE UPDATE ON public.locks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert initial pool stats for supported chains/tokens
INSERT INTO public.pool_stats (chain, token) VALUES
  ('ethereum', 'USDC'),
  ('ethereum', 'USDT'),
  ('ethereum', 'DAI'),
  ('base', 'USDC'),
  ('solana', 'USDC'),
  ('solana', 'USDT'),
  ('tron', 'USDT'),
  ('tron', 'USDC');