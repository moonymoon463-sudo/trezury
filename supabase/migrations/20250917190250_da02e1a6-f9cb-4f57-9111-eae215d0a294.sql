-- Create swap_quotes table for storing swap quotes
CREATE TABLE public.swap_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  input_asset TEXT NOT NULL,
  output_asset TEXT NOT NULL,
  input_amount NUMERIC NOT NULL,
  output_amount NUMERIC NOT NULL,
  exchange_rate NUMERIC NOT NULL,
  fee NUMERIC NOT NULL,
  minimum_received NUMERIC NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.swap_quotes ENABLE ROW LEVEL SECURITY;

-- Create policies for swap quotes
CREATE POLICY "Users can create their own swap quotes" 
ON public.swap_quotes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own swap quotes" 
ON public.swap_quotes 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_swap_quotes_updated_at
BEFORE UPDATE ON public.swap_quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();