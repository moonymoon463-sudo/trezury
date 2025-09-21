-- Phase 1: Create Aave-Style Lending Tables

-- Pool reserves table - stores real-time data for each asset pool
CREATE TABLE public.pool_reserves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'ethereum',
  total_supply_dec NUMERIC NOT NULL DEFAULT 0,
  total_borrowed_dec NUMERIC NOT NULL DEFAULT 0,
  available_liquidity_dec NUMERIC NOT NULL DEFAULT 0,
  utilization_rate NUMERIC NOT NULL DEFAULT 0,
  supply_rate NUMERIC NOT NULL DEFAULT 0,
  borrow_rate_variable NUMERIC NOT NULL DEFAULT 0,
  borrow_rate_stable NUMERIC NOT NULL DEFAULT 0,
  ltv NUMERIC NOT NULL DEFAULT 0.8, -- Loan to value ratio
  liquidation_threshold NUMERIC NOT NULL DEFAULT 0.85,
  liquidation_bonus NUMERIC NOT NULL DEFAULT 0.05,
  reserve_factor NUMERIC NOT NULL DEFAULT 0.1,
  last_update_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  borrowing_enabled BOOLEAN NOT NULL DEFAULT true,
  stable_rate_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(asset, chain)
);

-- User supplies table - tracks what users have supplied (aToken equivalent)
CREATE TABLE public.user_supplies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  asset TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'ethereum',
  supplied_amount_dec NUMERIC NOT NULL DEFAULT 0,
  accrued_interest_dec NUMERIC NOT NULL DEFAULT 0,
  supply_rate_at_deposit NUMERIC NOT NULL DEFAULT 0,
  last_interest_update TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_as_collateral BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset, chain)
);

-- User borrows table - tracks what users have borrowed
CREATE TABLE public.user_borrows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  asset TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'ethereum',
  borrowed_amount_dec NUMERIC NOT NULL DEFAULT 0,
  accrued_interest_dec NUMERIC NOT NULL DEFAULT 0,
  rate_mode TEXT NOT NULL DEFAULT 'variable', -- 'variable' or 'stable'
  borrow_rate_at_creation NUMERIC NOT NULL DEFAULT 0,
  last_interest_update TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset, chain, rate_mode)
);

-- Liquidation calls table - tracks liquidation events
CREATE TABLE public.liquidation_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- user being liquidated
  liquidator_id UUID, -- user performing liquidation
  collateral_asset TEXT NOT NULL,
  debt_asset TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'ethereum',
  debt_to_cover_dec NUMERIC NOT NULL,
  liquidated_collateral_dec NUMERIC NOT NULL,
  liquidation_bonus_dec NUMERIC NOT NULL,
  health_factor_before NUMERIC NOT NULL,
  health_factor_after NUMERIC NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Governance rewards table - AURU token rewards and staking
CREATE TABLE public.governance_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reward_type TEXT NOT NULL, -- 'supply', 'borrow', 'governance', 'staking'
  amount_dec NUMERIC NOT NULL DEFAULT 0,
  asset TEXT NOT NULL DEFAULT 'AURU',
  chain TEXT NOT NULL DEFAULT 'ethereum',
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  claimed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User health factor tracking
CREATE TABLE public.user_health_factors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chain TEXT NOT NULL DEFAULT 'ethereum',
  health_factor NUMERIC NOT NULL,
  total_collateral_usd NUMERIC NOT NULL DEFAULT 0,
  total_debt_usd NUMERIC NOT NULL DEFAULT 0,
  available_borrow_usd NUMERIC NOT NULL DEFAULT 0,
  ltv NUMERIC NOT NULL DEFAULT 0,
  liquidation_threshold NUMERIC NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, chain)
);

-- Interest rate model configurations
CREATE TABLE public.interest_rate_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'ethereum',
  optimal_utilization_rate NUMERIC NOT NULL DEFAULT 0.8,
  base_variable_borrow_rate NUMERIC NOT NULL DEFAULT 0.02,
  variable_rate_slope1 NUMERIC NOT NULL DEFAULT 0.05,
  variable_rate_slope2 NUMERIC NOT NULL DEFAULT 1.0,
  stable_rate_slope1 NUMERIC NOT NULL DEFAULT 0.02,
  stable_rate_slope2 NUMERIC NOT NULL DEFAULT 0.75,
  base_stable_borrow_rate NUMERIC NOT NULL DEFAULT 0.04,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(asset, chain)
);

-- Insert default pool reserve configurations for supported assets
INSERT INTO public.pool_reserves (asset, chain, ltv, liquidation_threshold, liquidation_bonus, reserve_factor) VALUES
('USDC', 'ethereum', 0.85, 0.90, 0.05, 0.10),
('USDC', 'base', 0.85, 0.90, 0.05, 0.10),
('USDT', 'ethereum', 0.85, 0.90, 0.05, 0.10),
('DAI', 'ethereum', 0.85, 0.90, 0.05, 0.10),
('XAUT', 'ethereum', 0.70, 0.75, 0.10, 0.15),
('AURU', 'ethereum', 0.60, 0.65, 0.15, 0.20);

-- Insert default interest rate models
INSERT INTO public.interest_rate_models (asset, chain, optimal_utilization_rate, base_variable_borrow_rate, variable_rate_slope1, variable_rate_slope2) VALUES
('USDC', 'ethereum', 0.80, 0.02, 0.05, 1.0),
('USDC', 'base', 0.80, 0.02, 0.05, 1.0),
('USDT', 'ethereum', 0.80, 0.02, 0.05, 1.0),
('DAI', 'ethereum', 0.80, 0.02, 0.05, 1.0),
('XAUT', 'ethereum', 0.70, 0.03, 0.08, 1.5),
('AURU', 'ethereum', 0.60, 0.05, 0.15, 2.0);

-- Enable RLS on new tables
ALTER TABLE public.pool_reserves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_borrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidation_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_health_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_rate_models ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pool_reserves (public read, admin write)
CREATE POLICY "Pool reserves are viewable by everyone" ON public.pool_reserves FOR SELECT USING (true);
CREATE POLICY "Only service role can update pool reserves" ON public.pool_reserves FOR ALL USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- RLS Policies for user_supplies
CREATE POLICY "Users can view their own supplies" ON public.user_supplies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own supplies" ON public.user_supplies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own supplies" ON public.user_supplies FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for user_borrows
CREATE POLICY "Users can view their own borrows" ON public.user_borrows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own borrows" ON public.user_borrows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own borrows" ON public.user_borrows FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for liquidation_calls
CREATE POLICY "Users can view liquidations they're involved in" ON public.liquidation_calls FOR SELECT USING (auth.uid() = user_id OR auth.uid() = liquidator_id);
CREATE POLICY "Service role can manage liquidations" ON public.liquidation_calls FOR ALL USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- RLS Policies for governance_rewards
CREATE POLICY "Users can view their own rewards" ON public.governance_rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage rewards" ON public.governance_rewards FOR ALL USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- RLS Policies for user_health_factors
CREATE POLICY "Users can view their own health factor" ON public.user_health_factors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can update health factors" ON public.user_health_factors FOR ALL USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- RLS Policies for interest_rate_models
CREATE POLICY "Interest rate models are viewable by everyone" ON public.interest_rate_models FOR SELECT USING (true);
CREATE POLICY "Only service role can update rate models" ON public.interest_rate_models FOR ALL USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- Create updated_at triggers
CREATE TRIGGER update_pool_reserves_updated_at BEFORE UPDATE ON public.pool_reserves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_supplies_updated_at BEFORE UPDATE ON public.user_supplies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_borrows_updated_at BEFORE UPDATE ON public.user_borrows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_interest_rate_models_updated_at BEFORE UPDATE ON public.interest_rate_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();