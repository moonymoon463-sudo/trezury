-- Create deployed_contracts table for storing smart contract deployment information
CREATE TABLE public.deployed_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain TEXT NOT NULL,
  contracts JSONB NOT NULL DEFAULT '{}',
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deployer_address TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.deployed_contracts ENABLE ROW LEVEL SECURITY;

-- Only service role can manage deployed contracts
CREATE POLICY "Service role can manage deployed contracts" 
ON public.deployed_contracts 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Users can view deployed contracts (read-only)
CREATE POLICY "Users can view deployed contracts" 
ON public.deployed_contracts 
FOR SELECT 
USING (true);

-- Add indexes for performance
CREATE INDEX idx_deployed_contracts_chain ON public.deployed_contracts(chain);
CREATE INDEX idx_deployed_contracts_deployed_at ON public.deployed_contracts(deployed_at);

-- Add trigger for updated_at
CREATE TRIGGER update_deployed_contracts_updated_at
  BEFORE UPDATE ON public.deployed_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();