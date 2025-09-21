-- Create institutional_accounts table for enterprise users
CREATE TABLE public.institutional_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_name TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard', 'premium', 'enterprise')),
  features TEXT[] DEFAULT ARRAY['portfolio_management', 'basic_reporting', 'api_access'],
  multi_sig_required BOOLEAN DEFAULT false,
  signatories TEXT[] DEFAULT ARRAY[]::TEXT[],
  minimum_signatures INTEGER DEFAULT 1,
  white_label_config JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create team_members table for institutional team management
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institutional_account_id UUID NOT NULL REFERENCES public.institutional_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'trader', 'viewer', 'analyst')),
  permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(institutional_account_id, user_id)
);

-- Create compliance_reports table for regulatory reporting
CREATE TABLE public.compliance_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institutional_account_id UUID NOT NULL REFERENCES public.institutional_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('monthly', 'quarterly', 'annual', 'custom')),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  transactions_count INTEGER DEFAULT 0,
  volume_usd NUMERIC DEFAULT 0,
  fees_usd NUMERIC DEFAULT 0,
  risk_metrics JSONB DEFAULT '{}',
  compliance_checks JSONB DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  download_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.institutional_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for institutional_accounts
CREATE POLICY "Users can view institutional accounts they belong to" 
ON public.institutional_accounts 
FOR SELECT 
USING (
  admin_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE institutional_account_id = institutional_accounts.id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Admin emails can create institutional accounts" 
ON public.institutional_accounts 
FOR INSERT 
WITH CHECK (admin_email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Institutional admins can update their accounts" 
ON public.institutional_accounts 
FOR UPDATE 
USING (admin_email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

-- Create RLS policies for team_members
CREATE POLICY "Team members can view their institutional team" 
ON public.team_members 
FOR SELECT 
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.institutional_accounts ia 
    WHERE ia.id = team_members.institutional_account_id 
    AND ia.admin_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Institutional admins can manage team members" 
ON public.team_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.institutional_accounts ia 
    WHERE ia.id = team_members.institutional_account_id 
    AND ia.admin_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);

-- Create RLS policies for compliance_reports
CREATE POLICY "Team members can view institutional compliance reports" 
ON public.compliance_reports 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm 
    WHERE tm.institutional_account_id = compliance_reports.institutional_account_id 
    AND tm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.institutional_accounts ia 
    WHERE ia.id = compliance_reports.institutional_account_id 
    AND ia.admin_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Institutional admins can manage compliance reports" 
ON public.compliance_reports 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.institutional_accounts ia 
    WHERE ia.id = compliance_reports.institutional_account_id 
    AND ia.admin_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);

-- Add triggers for updated_at columns
CREATE TRIGGER update_institutional_accounts_updated_at
  BEFORE UPDATE ON public.institutional_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_reports_updated_at
  BEFORE UPDATE ON public.compliance_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();