-- Drop existing trigger if exists to avoid conflicts
DROP TRIGGER IF EXISTS update_deployed_contracts_updated_at ON public.deployed_contracts;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_deployed_contracts_updated_at
BEFORE UPDATE ON public.deployed_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();