-- Create deployed_contracts table for storing smart contract deployment information
CREATE TABLE IF NOT EXISTS public.deployed_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain TEXT NOT NULL UNIQUE,
  contracts JSONB NOT NULL,
  deployed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deployer_address TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.deployed_contracts ENABLE ROW LEVEL SECURITY;

-- Create policies for deployed_contracts
CREATE POLICY "Allow authenticated users to read deployed contracts" 
ON public.deployed_contracts 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert deployed contracts" 
ON public.deployed_contracts 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update deployed contracts" 
ON public.deployed_contracts 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_deployed_contracts_updated_at
BEFORE UPDATE ON public.deployed_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();