-- Store encrypted private keys for instant wallet creation
CREATE TABLE IF NOT EXISTS public.encrypted_wallet_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_private_key text NOT NULL,
  encryption_iv text NOT NULL,
  encryption_salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.encrypted_wallet_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access only their own encrypted keys"
ON public.encrypted_wallet_keys
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_encrypted_wallet_keys_user_id ON public.encrypted_wallet_keys(user_id);