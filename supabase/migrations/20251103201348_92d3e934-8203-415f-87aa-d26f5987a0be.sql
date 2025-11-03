-- Create hyperliquid_wallets table for storing encrypted trading wallets
CREATE TABLE IF NOT EXISTS public.hyperliquid_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  encryption_method TEXT NOT NULL DEFAULT 'AES-256-GCM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create bridge_transactions table for tracking cross-chain deposits
CREATE TABLE IF NOT EXISTS public.bridge_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_chain TEXT NOT NULL,
  destination_chain TEXT NOT NULL,
  source_tx_hash TEXT,
  destination_tx_hash TEXT,
  bridge_provider TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  token TEXT NOT NULL DEFAULT 'USDC',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  estimated_completion TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.hyperliquid_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bridge_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hyperliquid_wallets
CREATE POLICY "Users can view their own hyperliquid wallet"
  ON public.hyperliquid_wallets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own hyperliquid wallet"
  ON public.hyperliquid_wallets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hyperliquid wallet"
  ON public.hyperliquid_wallets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for bridge_transactions
CREATE POLICY "Users can view their own bridge transactions"
  ON public.bridge_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bridge transactions"
  ON public.bridge_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_hyperliquid_wallets_user_id ON public.hyperliquid_wallets(user_id);
CREATE INDEX idx_hyperliquid_wallets_address ON public.hyperliquid_wallets(address);
CREATE INDEX idx_bridge_transactions_user_id ON public.bridge_transactions(user_id);
CREATE INDEX idx_bridge_transactions_status ON public.bridge_transactions(status);
CREATE INDEX idx_bridge_transactions_created_at ON public.bridge_transactions(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_hyperliquid_wallets_updated_at
  BEFORE UPDATE ON public.hyperliquid_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bridge_transactions_updated_at
  BEFORE UPDATE ON public.bridge_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();