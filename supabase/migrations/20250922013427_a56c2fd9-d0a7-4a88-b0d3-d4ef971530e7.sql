-- Create flash loan history table
CREATE TABLE public.flash_loan_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  asset TEXT NOT NULL,
  amount_dec NUMERIC NOT NULL DEFAULT 0,
  fee_dec NUMERIC NOT NULL DEFAULT 0,
  profit_dec NUMERIC NOT NULL DEFAULT 0,
  opportunity_type TEXT NOT NULL,
  execution_status TEXT NOT NULL DEFAULT 'completed',
  tx_hash TEXT,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create advanced position limits table  
CREATE TABLE public.advanced_position_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  risk_tier TEXT NOT NULL DEFAULT 'standard',
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create liquidation auctions table
CREATE TABLE public.liquidation_auctions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id UUID NOT NULL,
  collateral_asset TEXT NOT NULL,
  debt_asset TEXT NOT NULL,
  collateral_amount_dec NUMERIC NOT NULL DEFAULT 0,
  debt_amount_dec NUMERIC NOT NULL DEFAULT 0,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  current_bid_amount_dec NUMERIC DEFAULT 0,
  current_bidder_id UUID,
  status TEXT NOT NULL DEFAULT 'active',
  chain TEXT NOT NULL DEFAULT 'ethereum',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.flash_loan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advanced_position_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidation_auctions ENABLE ROW LEVEL SECURITY;

-- RLS policies for flash_loan_history
CREATE POLICY "Users can view their own flash loan history" 
ON public.flash_loan_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert flash loan history" 
ON public.flash_loan_history 
FOR INSERT 
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS policies for advanced_position_limits
CREATE POLICY "Users can manage their own advanced position limits" 
ON public.advanced_position_limits 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for liquidation_auctions
CREATE POLICY "Anyone can view active liquidation auctions" 
ON public.liquidation_auctions 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage liquidation auctions" 
ON public.liquidation_auctions 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);