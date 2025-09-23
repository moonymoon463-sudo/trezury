-- Phase 6: Institutional & Governance Tables (Ethereum-focused)

-- Institutional accounts for enterprise clients
CREATE TABLE IF NOT EXISTS institutional_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'standard',
  features TEXT[] DEFAULT ARRAY['portfolio_management', 'basic_reporting', 'api_access'],
  multi_sig_required BOOLEAN DEFAULT false,
  minimum_signatures INTEGER DEFAULT 1,
  signatories TEXT[] DEFAULT ARRAY[],
  white_label_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team members for institutional accounts
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institutional_account_id UUID NOT NULL REFERENCES institutional_accounts(id),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  permissions TEXT[] DEFAULT ARRAY[],
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Governance rewards for AURU token holders
CREATE TABLE IF NOT EXISTS governance_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount_dec NUMERIC NOT NULL DEFAULT 0,
  reward_type TEXT NOT NULL,
  asset TEXT NOT NULL DEFAULT 'AURU',
  chain TEXT NOT NULL DEFAULT 'ethereum',
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compliance reports for institutional clients
CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institutional_account_id UUID NOT NULL REFERENCES institutional_accounts(id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  transactions_count INTEGER DEFAULT 0,
  volume_usd NUMERIC DEFAULT 0,
  fees_usd NUMERIC DEFAULT 0,
  risk_metrics JSONB DEFAULT '{}',
  compliance_checks JSONB DEFAULT '{}',
  type TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  download_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE institutional_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for institutional_accounts
CREATE POLICY "Users can view institutional accounts they belong to" ON institutional_accounts
FOR SELECT USING (
  admin_email = (SELECT email FROM profiles WHERE id = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_members.institutional_account_id = institutional_accounts.id 
    AND team_members.user_id = auth.uid()
  )
);

CREATE POLICY "Admin emails can create institutional accounts" ON institutional_accounts
FOR INSERT WITH CHECK (
  admin_email = (SELECT email FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Institutional admins can update their accounts" ON institutional_accounts
FOR UPDATE USING (
  admin_email = (SELECT email FROM profiles WHERE id = auth.uid())
);

-- RLS Policies for team_members
CREATE POLICY "Team members can view their institutional team" ON team_members
FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM institutional_accounts ia 
    WHERE ia.id = team_members.institutional_account_id 
    AND ia.admin_email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Institutional admins can manage team members" ON team_members
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM institutional_accounts ia 
    WHERE ia.id = team_members.institutional_account_id 
    AND ia.admin_email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);

-- RLS Policies for governance_rewards
CREATE POLICY "Users can view their own rewards" ON governance_rewards
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage rewards" ON governance_rewards
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for compliance_reports
CREATE POLICY "Team members can view institutional compliance reports" ON compliance_reports
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM team_members tm 
    WHERE tm.institutional_account_id = compliance_reports.institutional_account_id 
    AND tm.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM institutional_accounts ia 
    WHERE ia.id = compliance_reports.institutional_account_id 
    AND ia.admin_email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Institutional admins can manage compliance reports" ON compliance_reports
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM institutional_accounts ia 
    WHERE ia.id = compliance_reports.institutional_account_id 
    AND ia.admin_email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);

-- Functions for governance rewards distribution
CREATE OR REPLACE FUNCTION distribute_governance_rewards()
RETURNS VOID AS $$
DECLARE
  user_record RECORD;
  total_auru_supplied NUMERIC := 0;
  weekly_reward_pool NUMERIC := 50000; -- 50k AURU per week
  user_reward NUMERIC;
BEGIN
  -- Calculate total AURU supplied across all users
  SELECT COALESCE(SUM(supplied_amount_dec), 0) INTO total_auru_supplied
  FROM user_supplies 
  WHERE asset = 'AURU' AND supplied_amount_dec > 0;
  
  -- Only distribute if there are AURU suppliers
  IF total_auru_supplied > 0 THEN
    -- Calculate and distribute rewards for each AURU supplier
    FOR user_record IN 
      SELECT user_id, supplied_amount_dec, chain
      FROM user_supplies 
      WHERE asset = 'AURU' AND supplied_amount_dec > 0
    LOOP
      -- Calculate proportional reward
      user_reward := (user_record.supplied_amount_dec / total_auru_supplied) * weekly_reward_pool;
      
      -- Insert governance reward
      INSERT INTO governance_rewards (
        user_id, 
        amount_dec, 
        reward_type, 
        asset, 
        chain, 
        metadata
      ) VALUES (
        user_record.user_id,
        user_reward,
        'weekly_supply_reward',
        'AURU',
        user_record.chain,
        jsonb_build_object(
          'total_pool', weekly_reward_pool,
          'user_share', user_record.supplied_amount_dec / total_auru_supplied,
          'calculation_date', now()
        )
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;