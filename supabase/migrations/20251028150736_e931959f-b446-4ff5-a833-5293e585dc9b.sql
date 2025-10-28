-- Create Synthetix trading tables

-- Synthetix accounts table
CREATE TABLE IF NOT EXISTS public.snx_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, chain_id)
);

-- Synthetix orders table
CREATE TABLE IF NOT EXISTS public.snx_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  market_key TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('MARKET', 'LIMIT', 'STOP_MARKET', 'STOP_LIMIT')),
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  size DECIMAL NOT NULL,
  leverage DECIMAL NOT NULL,
  price DECIMAL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED', 'FAILED')),
  filled_size DECIMAL DEFAULT 0,
  filled_price DECIMAL,
  tx_hash TEXT,
  chain_id INTEGER NOT NULL,
  wallet_source TEXT NOT NULL CHECK (wallet_source IN ('internal', 'external')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  filled_at TIMESTAMPTZ,
  metadata JSONB
);

-- Synthetix positions table
CREATE TABLE IF NOT EXISTS public.snx_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  market_key TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
  size DECIMAL NOT NULL,
  entry_price DECIMAL NOT NULL,
  leverage DECIMAL NOT NULL,
  unrealized_pnl DECIMAL DEFAULT 0,
  realized_pnl DECIMAL DEFAULT 0,
  liquidation_price DECIMAL NOT NULL,
  funding_accrued DECIMAL DEFAULT 0,
  chain_id INTEGER NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED', 'LIQUIDATED')),
  UNIQUE(account_id, market_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Enable RLS
ALTER TABLE public.snx_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snx_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snx_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own snx_accounts"
  ON public.snx_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snx_accounts"
  ON public.snx_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own snx_orders"
  ON public.snx_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snx_orders"
  ON public.snx_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own snx_positions"
  ON public.snx_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snx_positions"
  ON public.snx_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own snx_positions"
  ON public.snx_positions FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_snx_accounts_user_chain ON public.snx_accounts(user_id, chain_id);
CREATE INDEX idx_snx_orders_user ON public.snx_orders(user_id, created_at DESC);
CREATE INDEX idx_snx_positions_user_status ON public.snx_positions(user_id, status);
CREATE INDEX idx_snx_positions_account_market ON public.snx_positions(account_id, market_id);

-- Updated timestamp trigger
CREATE TRIGGER snx_accounts_updated_at BEFORE UPDATE ON public.snx_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER snx_orders_updated_at BEFORE UPDATE ON public.snx_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();