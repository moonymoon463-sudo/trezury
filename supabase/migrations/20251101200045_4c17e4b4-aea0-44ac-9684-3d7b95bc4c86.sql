-- Create trade logs table for 01 Protocol operations

CREATE TABLE IF NOT EXISTS public.trade_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  market TEXT,
  side TEXT,
  size NUMERIC,
  price NUMERIC,
  order_id TEXT,
  status TEXT NOT NULL,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trade_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own trade logs"
  ON public.trade_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trade logs"
  ON public.trade_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_trade_logs_user_id ON public.trade_logs(user_id);
CREATE INDEX idx_trade_logs_created_at ON public.trade_logs(created_at DESC);
CREATE INDEX idx_trade_logs_market ON public.trade_logs(market);
CREATE INDEX idx_trade_logs_status ON public.trade_logs(status);