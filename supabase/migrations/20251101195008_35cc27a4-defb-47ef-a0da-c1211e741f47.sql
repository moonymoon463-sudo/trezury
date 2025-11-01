-- Create RPC functions for Solana wallet operations

-- Function to get user salt
CREATE OR REPLACE FUNCTION public.get_user_salt(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT salt FROM public.user_salts WHERE user_id = p_user_id);
END;
$$;

-- Function to set user salt
CREATE OR REPLACE FUNCTION public.set_user_salt(p_user_id UUID, p_salt TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_salts (user_id, salt)
  VALUES (p_user_id, p_salt)
  ON CONFLICT (user_id) DO UPDATE SET salt = p_salt;
END;
$$;

-- Function to upsert Solana wallet
CREATE OR REPLACE FUNCTION public.upsert_solana_wallet(
  p_user_id UUID,
  p_encrypted_key TEXT,
  p_public_key TEXT,
  p_salt TEXT,
  p_iv TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.solana_wallets (
    user_id,
    encrypted_private_key,
    public_key,
    encryption_salt,
    encryption_iv,
    encryption_method
  )
  VALUES (
    p_user_id,
    p_encrypted_key,
    p_public_key,
    p_salt,
    p_iv,
    'AES-GCM-256'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    encrypted_private_key = p_encrypted_key,
    public_key = p_public_key,
    encryption_salt = p_salt,
    encryption_iv = p_iv,
    updated_at = now();
END;
$$;

-- Function to get Solana wallet
CREATE OR REPLACE FUNCTION public.get_solana_wallet(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT row_to_json(w)
    FROM public.solana_wallets w
    WHERE w.user_id = p_user_id
  );
END;
$$;

-- Function to get Solana public key
CREATE OR REPLACE FUNCTION public.get_solana_public_key(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT public_key FROM public.solana_wallets WHERE user_id = p_user_id);
END;
$$;