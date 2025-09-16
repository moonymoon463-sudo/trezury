-- Remove the insecure user_wallet_keys table entirely
-- Private keys should NEVER be stored in any database
DROP TABLE IF EXISTS public.user_wallet_keys;