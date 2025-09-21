-- Create deployment_logs table for detailed deployment tracking
CREATE TABLE public.deployment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deployment_id UUID NOT NULL DEFAULT gen_random_uuid(),
  chain TEXT NOT NULL,
  operation TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  error_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deployment_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view deployment logs" 
ON public.deployment_logs 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can insert deployment logs" 
ON public.deployment_logs 
FOR INSERT 
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- Create index for efficient querying
CREATE INDEX idx_deployment_logs_deployment_id ON public.deployment_logs(deployment_id);
CREATE INDEX idx_deployment_logs_created_at ON public.deployment_logs(created_at DESC);
CREATE INDEX idx_deployment_logs_chain_operation ON public.deployment_logs(chain, operation);