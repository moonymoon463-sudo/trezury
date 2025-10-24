-- Create dydx_orders table
CREATE TABLE IF NOT EXISTS public.dydx_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  address text NOT NULL,
  order_id text UNIQUE,
  client_order_id text UNIQUE NOT NULL,
  market text NOT NULL,
  side text NOT NULL CHECK (side IN ('BUY', 'SELL')),
  order_type text NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP_MARKET', 'STOP_LIMIT')),
  size numeric NOT NULL CHECK (size > 0),
  price numeric,
  leverage numeric NOT NULL CHECK (leverage >= 1 AND leverage <= 20),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'OPEN', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'EXPIRED', 'FAILED')),
  filled_size numeric DEFAULT 0 CHECK (filled_size >= 0),
  average_fill_price numeric,
  tx_hash text,
  time_in_force text DEFAULT 'GTT' CHECK (time_in_force IN ('GTT', 'FOK', 'IOC')),
  reduce_only boolean DEFAULT false,
  post_only boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  filled_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create dydx_positions table
CREATE TABLE IF NOT EXISTS public.dydx_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  address text NOT NULL,
  market text NOT NULL,
  side text NOT NULL CHECK (side IN ('LONG', 'SHORT')),
  size numeric NOT NULL CHECK (size > 0),
  entry_price numeric NOT NULL CHECK (entry_price > 0),
  leverage numeric NOT NULL CHECK (leverage >= 1 AND leverage <= 20),
  unrealized_pnl numeric DEFAULT 0,
  realized_pnl numeric DEFAULT 0,
  liquidation_price numeric NOT NULL CHECK (liquidation_price > 0),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'LIQUIDATED'))
);

-- Create partial unique index for open positions
CREATE UNIQUE INDEX IF NOT EXISTS idx_dydx_positions_unique_open 
ON public.dydx_positions(user_id, market, status) 
WHERE status = 'OPEN';

-- Create dydx_account_snapshots table
CREATE TABLE IF NOT EXISTS public.dydx_account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  address text NOT NULL,
  equity numeric NOT NULL CHECK (equity >= 0),
  free_collateral numeric NOT NULL CHECK (free_collateral >= 0),
  margin_usage numeric NOT NULL CHECK (margin_usage >= 0 AND margin_usage <= 1),
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dydx_orders_user_id ON public.dydx_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_dydx_orders_address ON public.dydx_orders(address);
CREATE INDEX IF NOT EXISTS idx_dydx_orders_status ON public.dydx_orders(status);
CREATE INDEX IF NOT EXISTS idx_dydx_orders_market ON public.dydx_orders(market);
CREATE INDEX IF NOT EXISTS idx_dydx_orders_created_at ON public.dydx_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dydx_positions_user_id ON public.dydx_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_dydx_positions_address ON public.dydx_positions(address);
CREATE INDEX IF NOT EXISTS idx_dydx_positions_status ON public.dydx_positions(status);
CREATE INDEX IF NOT EXISTS idx_dydx_positions_market ON public.dydx_positions(market);

CREATE INDEX IF NOT EXISTS idx_dydx_snapshots_user_id ON public.dydx_account_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_dydx_snapshots_address ON public.dydx_account_snapshots(address);
CREATE INDEX IF NOT EXISTS idx_dydx_snapshots_timestamp ON public.dydx_account_snapshots(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE public.dydx_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dydx_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dydx_account_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dydx_orders
CREATE POLICY "Users can view their own orders"
  ON public.dydx_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
  ON public.dydx_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders"
  ON public.dydx_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all orders"
  ON public.dydx_orders FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS Policies for dydx_positions
CREATE POLICY "Users can view their own positions"
  ON public.dydx_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own positions"
  ON public.dydx_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own positions"
  ON public.dydx_positions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all positions"
  ON public.dydx_positions FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS Policies for dydx_account_snapshots
CREATE POLICY "Users can view their own snapshots"
  ON public.dydx_account_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own snapshots"
  ON public.dydx_account_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all snapshots"
  ON public.dydx_account_snapshots FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Create trigger for updated_at
CREATE TRIGGER update_dydx_orders_updated_at
  BEFORE UPDATE ON public.dydx_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
