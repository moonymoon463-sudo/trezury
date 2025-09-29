-- Create api_rate_limits table for backend rate limiting
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address or user_id
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  last_request TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, endpoint)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON public.api_rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON public.api_rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.api_rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON public.api_rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

-- Enable RLS
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limits
CREATE POLICY "Service role only access to rate limits"
  ON public.api_rate_limits
  FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Create function to cleanup old rate limit records (run daily)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete records older than 24 hours
  DELETE FROM public.api_rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours'
    AND (blocked_until IS NULL OR blocked_until < NOW());
END;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_api_rate_limits_updated_at
  BEFORE UPDATE ON public.api_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();