-- Drop old dYdX tables
DROP TABLE IF EXISTS dydx_orders CASCADE;
DROP TABLE IF EXISTS dydx_positions CASCADE;
DROP TABLE IF EXISTS dydx_account_snapshots CASCADE;
DROP TABLE IF EXISTS dydx_wallets CASCADE;

-- Create Hyperliquid positions table
CREATE TABLE hyperliquid_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  address TEXT NOT NULL,
  market TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
  size DECIMAL NOT NULL,
  entry_price DECIMAL NOT NULL,
  leverage DECIMAL NOT NULL,
  unrealized_pnl DECIMAL DEFAULT 0,
  realized_pnl DECIMAL DEFAULT 0,
  liquidation_price DECIMAL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'LIQUIDATED')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Hyperliquid orders table
CREATE TABLE hyperliquid_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  address TEXT NOT NULL,
  order_id BIGINT,
  client_order_id TEXT NOT NULL,
  market TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  order_type TEXT NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP_MARKET', 'STOP_LIMIT')),
  size DECIMAL NOT NULL,
  price DECIMAL,
  leverage DECIMAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'OPEN', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'FAILED')),
  filled_size DECIMAL DEFAULT 0,
  average_fill_price DECIMAL,
  reduce_only BOOLEAN DEFAULT false,
  post_only BOOLEAN DEFAULT false,
  time_in_force TEXT DEFAULT 'GTC',
  tx_hash TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filled_at TIMESTAMPTZ
);

-- Create Hyperliquid account snapshots table
CREATE TABLE hyperliquid_account_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  address TEXT NOT NULL,
  account_value DECIMAL NOT NULL,
  equity DECIMAL NOT NULL,
  free_collateral DECIMAL NOT NULL,
  margin_usage DECIMAL NOT NULL,
  total_position_value DECIMAL NOT NULL,
  withdrawable DECIMAL NOT NULL,
  unrealized_pnl DECIMAL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Hyperliquid trades table
CREATE TABLE hyperliquid_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  address TEXT NOT NULL,
  order_id BIGINT,
  trade_id BIGINT,
  market TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  size DECIMAL NOT NULL,
  price DECIMAL NOT NULL,
  fee DECIMAL NOT NULL,
  fee_asset TEXT DEFAULT 'USDC',
  is_maker BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_hyperliquid_positions_user ON hyperliquid_positions(user_id);
CREATE INDEX idx_hyperliquid_positions_address ON hyperliquid_positions(address);
CREATE INDEX idx_hyperliquid_positions_status ON hyperliquid_positions(status);
CREATE INDEX idx_hyperliquid_positions_market ON hyperliquid_positions(market);

CREATE INDEX idx_hyperliquid_orders_user ON hyperliquid_orders(user_id);
CREATE INDEX idx_hyperliquid_orders_address ON hyperliquid_orders(address);
CREATE INDEX idx_hyperliquid_orders_status ON hyperliquid_orders(status);
CREATE INDEX idx_hyperliquid_orders_market ON hyperliquid_orders(market);
CREATE INDEX idx_hyperliquid_orders_order_id ON hyperliquid_orders(order_id);

CREATE INDEX idx_hyperliquid_snapshots_user ON hyperliquid_account_snapshots(user_id);
CREATE INDEX idx_hyperliquid_snapshots_address ON hyperliquid_account_snapshots(address);
CREATE INDEX idx_hyperliquid_snapshots_timestamp ON hyperliquid_account_snapshots(timestamp DESC);

CREATE INDEX idx_hyperliquid_trades_user ON hyperliquid_trades(user_id);
CREATE INDEX idx_hyperliquid_trades_address ON hyperliquid_trades(address);
CREATE INDEX idx_hyperliquid_trades_market ON hyperliquid_trades(market);
CREATE INDEX idx_hyperliquid_trades_timestamp ON hyperliquid_trades(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE hyperliquid_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hyperliquid_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE hyperliquid_account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE hyperliquid_trades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for positions
CREATE POLICY "Users can view their own positions" ON hyperliquid_positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own positions" ON hyperliquid_positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own positions" ON hyperliquid_positions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all positions" ON hyperliquid_positions
  FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS Policies for orders
CREATE POLICY "Users can view their own orders" ON hyperliquid_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders" ON hyperliquid_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders" ON hyperliquid_orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all orders" ON hyperliquid_orders
  FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS Policies for account snapshots
CREATE POLICY "Users can view their own snapshots" ON hyperliquid_account_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own snapshots" ON hyperliquid_account_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all snapshots" ON hyperliquid_account_snapshots
  FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS Policies for trades
CREATE POLICY "Users can view their own trades" ON hyperliquid_trades
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades" ON hyperliquid_trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all trades" ON hyperliquid_trades
  FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_hyperliquid_positions_updated_at
  BEFORE UPDATE ON hyperliquid_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hyperliquid_orders_updated_at
  BEFORE UPDATE ON hyperliquid_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();