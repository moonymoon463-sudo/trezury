-- Create webhook_dlq table for failed webhook retries
CREATE TABLE IF NOT EXISTS public.webhook_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  error_details JSONB DEFAULT '{}'::jsonb,
  original_timestamp TIMESTAMPTZ NOT NULL,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replayed_at TIMESTAMPTZ,
  replay_status TEXT DEFAULT 'pending',
  replay_error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_dlq ENABLE ROW LEVEL SECURITY;

-- Admins can view all DLQ entries
CREATE POLICY "Admins can view webhook DLQ"
  ON public.webhook_dlq
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Admins can update DLQ entries (for replay)
CREATE POLICY "Admins can update webhook DLQ"
  ON public.webhook_dlq
  FOR UPDATE
  USING (is_admin(auth.uid()));

-- Service role can insert DLQ entries
CREATE POLICY "Service role can insert webhook DLQ"
  ON public.webhook_dlq
  FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_webhook_dlq_event_type ON public.webhook_dlq(event_type);
CREATE INDEX idx_webhook_dlq_replay_status ON public.webhook_dlq(replay_status);
CREATE INDEX idx_webhook_dlq_queued_at ON public.webhook_dlq(queued_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_webhook_dlq_updated_at
  BEFORE UPDATE ON public.webhook_dlq
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to replay webhook from DLQ
CREATE OR REPLACE FUNCTION public.replay_webhook_from_dlq(dlq_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dlq_entry RECORD;
  result RECORD;
BEGIN
  -- Check if requesting user is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('error', 'Admin access required', 'success', false);
  END IF;

  -- Get DLQ entry
  SELECT * INTO dlq_entry
  FROM webhook_dlq
  WHERE id = dlq_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'DLQ entry not found', 'success', false);
  END IF;

  -- Make HTTP request to replay webhook
  SELECT INTO result net.http_post(
    url := 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/moonpay-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-moonpay-signature', COALESCE(dlq_entry.signature, ''),
      'x-replay-from-dlq', 'true'
    ),
    body := dlq_entry.payload
  );

  -- Update DLQ entry
  UPDATE webhook_dlq
  SET 
    replayed_at = now(),
    replay_status = 'completed',
    updated_at = now()
  WHERE id = dlq_id;

  RETURN json_build_object(
    'success', true,
    'request_id', result,
    'message', 'Webhook replayed successfully',
    'dlq_id', dlq_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Update with error
  UPDATE webhook_dlq
  SET 
    replay_status = 'failed',
    replay_error = SQLERRM,
    updated_at = now()
  WHERE id = dlq_id;
  
  RETURN json_build_object(
    'error', SQLERRM,
    'success', false,
    'dlq_id', dlq_id
  );
END;
$$;