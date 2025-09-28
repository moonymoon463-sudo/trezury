-- Create MoonPay recurring buys tables

-- Link app users to MoonPay accounts
CREATE TABLE IF NOT EXISTS public.moonpay_customers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  country_code TEXT DEFAULT 'GB',
  kyc_status TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store transactions and recurring-related events (mirror from webhooks)
CREATE TABLE IF NOT EXISTS public.moonpay_transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  moonpay_tx_id TEXT,
  asset_symbol TEXT NOT NULL,
  amount_fiat NUMERIC,
  currency_fiat TEXT,
  amount_crypto NUMERIC,
  address TEXT,
  status TEXT DEFAULT 'initiated',
  is_recurring BOOLEAN DEFAULT TRUE,
  recurring_frequency TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  raw_webhook JSONB
);

-- Store all webhook deliveries for audit/debug
CREATE TABLE IF NOT EXISTS public.moonpay_webhooks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.moonpay_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moonpay_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moonpay_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for moonpay_customers
CREATE POLICY "Users can insert their own MoonPay customer data"
  ON public.moonpay_customers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own MoonPay customer data"
  ON public.moonpay_customers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own MoonPay customer data"
  ON public.moonpay_customers FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for moonpay_transactions
CREATE POLICY "Users can insert their own MoonPay transactions"
  ON public.moonpay_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own MoonPay transactions"
  ON public.moonpay_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own MoonPay transactions"
  ON public.moonpay_transactions FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can manage transactions via webhooks
CREATE POLICY "Service role can manage MoonPay transactions"
  ON public.moonpay_transactions FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS Policies for moonpay_webhooks (admin only)
CREATE POLICY "Service role can manage webhook logs"
  ON public.moonpay_webhooks FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Create indexes for performance
CREATE INDEX idx_moonpay_transactions_user_id ON public.moonpay_transactions(user_id);
CREATE INDEX idx_moonpay_transactions_moonpay_tx_id ON public.moonpay_transactions(moonpay_tx_id);
CREATE INDEX idx_moonpay_transactions_status ON public.moonpay_transactions(status);
CREATE INDEX idx_moonpay_webhooks_event_type ON public.moonpay_webhooks(event_type);

-- Add updated_at trigger for moonpay_customers
CREATE TRIGGER update_moonpay_customers_updated_at
  BEFORE UPDATE ON public.moonpay_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for moonpay_transactions  
CREATE TRIGGER update_moonpay_transactions_updated_at
  BEFORE UPDATE ON public.moonpay_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();