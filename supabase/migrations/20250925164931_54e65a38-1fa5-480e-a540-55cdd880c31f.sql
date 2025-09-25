-- Create historical gold price data table
CREATE TABLE public.gold_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  open_price NUMERIC NOT NULL,
  high_price NUMERIC NOT NULL,
  low_price NUMERIC NOT NULL,
  close_price NUMERIC NOT NULL,
  volume BIGINT DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'alpha_vantage',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate dates
CREATE UNIQUE INDEX idx_gold_price_history_date ON public.gold_price_history(date, source);

-- Create index for fast date range queries
CREATE INDEX idx_gold_price_history_date_range ON public.gold_price_history(date DESC);

-- Enable RLS
ALTER TABLE public.gold_price_history ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Anyone can view historical gold prices" ON public.gold_price_history
  FOR SELECT USING (true);

-- Create policy for service role to insert/update
CREATE POLICY "Service role can manage historical prices" ON public.gold_price_history
  FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Create trigger for updating timestamps
CREATE TRIGGER update_gold_price_history_updated_at
  BEFORE UPDATE ON public.gold_price_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();