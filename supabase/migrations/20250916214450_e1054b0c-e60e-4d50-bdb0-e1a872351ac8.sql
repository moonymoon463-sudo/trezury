-- Create fee collection requests table for external wallet integration
CREATE TABLE public.fee_collection_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  transaction_id UUID NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL DEFAULT '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835',
  amount NUMERIC NOT NULL,
  asset TEXT NOT NULL CHECK (asset IN ('USDC', 'XAUT')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  external_tx_hash TEXT,
  webhook_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.fee_collection_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own fee collection requests"
ON public.fee_collection_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert fee collection requests"
ON public.fee_collection_requests 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update fee collection requests"
ON public.fee_collection_requests 
FOR UPDATE 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_fee_collection_requests_user_id ON public.fee_collection_requests(user_id);
CREATE INDEX idx_fee_collection_requests_status ON public.fee_collection_requests(status);
CREATE INDEX idx_fee_collection_requests_transaction_id ON public.fee_collection_requests(transaction_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates (if not exists)
CREATE TRIGGER update_fee_collection_requests_updated_at
BEFORE UPDATE ON public.fee_collection_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();