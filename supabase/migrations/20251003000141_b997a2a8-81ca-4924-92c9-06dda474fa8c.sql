-- Allow users to insert their own wallet security events
CREATE POLICY "Users can insert own wallet security events"
ON public.wallet_security_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);