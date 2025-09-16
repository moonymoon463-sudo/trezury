-- Create user_wallet_keys table for storing encrypted private keys
CREATE TABLE public.user_wallet_keys (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security
ALTER TABLE public.user_wallet_keys ENABLE ROW LEVEL SECURITY;

-- Create policies for user wallet keys
CREATE POLICY "Users can view their own wallet keys" 
ON public.user_wallet_keys 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet keys" 
ON public.user_wallet_keys 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet keys" 
ON public.user_wallet_keys 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_user_wallet_keys_updated_at
BEFORE UPDATE ON public.user_wallet_keys
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create unique index on user_id to ensure one wallet per user
CREATE UNIQUE INDEX idx_user_wallet_keys_user_id ON public.user_wallet_keys(user_id);