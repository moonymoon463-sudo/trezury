-- Create Solana wallet tables for 01 Protocol trading

-- Table for storing encrypted Solana keypairs
CREATE TABLE IF NOT EXISTS public.solana_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  encryption_salt TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_method TEXT NOT NULL DEFAULT 'AES-GCM-256',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Table for user salts (for key derivation)
CREATE TABLE IF NOT EXISTS public.user_salts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  salt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.solana_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_salts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for solana_wallets
CREATE POLICY "Users can view their own Solana wallet"
  ON public.solana_wallets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Solana wallet"
  ON public.solana_wallets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Solana wallet"
  ON public.solana_wallets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for user_salts
CREATE POLICY "Users can view their own salt"
  ON public.user_salts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own salt"
  ON public.user_salts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_solana_wallets_user_id ON public.solana_wallets(user_id);
CREATE INDEX idx_user_salts_user_id ON public.user_salts(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_solana_wallets_updated_at
  BEFORE UPDATE ON public.solana_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();