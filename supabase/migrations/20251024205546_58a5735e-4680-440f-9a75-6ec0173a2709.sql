-- Create table for dYdX Cosmos wallets
CREATE TABLE public.dydx_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dydx_address text NOT NULL UNIQUE,
  encrypted_mnemonic text NOT NULL,
  encryption_iv text NOT NULL,
  encryption_salt text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dydx_wallets ENABLE ROW LEVEL SECURITY;

-- Policies for dydx_wallets
CREATE POLICY "Users can access only their own dYdX wallet"
  ON public.dydx_wallets
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_dydx_wallets_address ON public.dydx_wallets(dydx_address);

-- Add columns to profiles table for dYdX address mapping
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dydx_address text;
CREATE INDEX IF NOT EXISTS idx_profiles_dydx_address ON public.profiles(dydx_address);