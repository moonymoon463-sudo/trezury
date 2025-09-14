-- Create payment_methods table for card/bank payment methods
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('card', 'bank_account')),
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Create onchain_addresses table for USDC deposit addresses per user
CREATE TABLE public.onchain_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  address TEXT NOT NULL UNIQUE,
  chain TEXT NOT NULL DEFAULT 'base',
  asset TEXT NOT NULL DEFAULT 'USDC',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Create deposits table to track incoming USDC deposits
CREATE TABLE public.deposits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  asset TEXT NOT NULL DEFAULT 'USDC',
  chain TEXT NOT NULL DEFAULT 'base',
  tx_hash TEXT UNIQUE,
  block_number BIGINT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB NOT NULL DEFAULT '{}'
);

-- Add new columns to quotes table for multi-asset support
ALTER TABLE public.quotes 
ADD COLUMN input_asset TEXT DEFAULT 'USDC',
ADD COLUMN output_asset TEXT DEFAULT 'GOLD',
ADD COLUMN input_amount NUMERIC,
ADD COLUMN output_amount NUMERIC;

-- Add new columns to transactions table for enhanced tracking
ALTER TABLE public.transactions 
ADD COLUMN input_asset TEXT,
ADD COLUMN output_asset TEXT,
ADD COLUMN deposit_id UUID REFERENCES public.deposits(id),
ADD COLUMN quote_id UUID REFERENCES public.quotes(id);

-- Enable RLS on new tables
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onchain_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payment_methods
CREATE POLICY "Users can view own payment methods" 
ON public.payment_methods 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment methods" 
ON public.payment_methods 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods" 
ON public.payment_methods 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create RLS policies for onchain_addresses
CREATE POLICY "Users can view own onchain addresses" 
ON public.onchain_addresses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onchain addresses" 
ON public.onchain_addresses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for deposits
CREATE POLICY "Users can view own deposits" 
ON public.deposits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deposits" 
ON public.deposits 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deposits" 
ON public.deposits 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_payment_methods_user_id ON public.payment_methods(user_id);
CREATE INDEX idx_payment_methods_type ON public.payment_methods(type);
CREATE INDEX idx_onchain_addresses_user_id ON public.onchain_addresses(user_id);
CREATE INDEX idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX idx_deposits_status ON public.deposits(status);
CREATE INDEX idx_deposits_tx_hash ON public.deposits(tx_hash);
CREATE INDEX idx_transactions_quote_id ON public.transactions(quote_id);
CREATE INDEX idx_transactions_deposit_id ON public.transactions(deposit_id);