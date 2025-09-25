-- Create AI analysis cache table for performance optimization
CREATE TABLE IF NOT EXISTS public.ai_analysis_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_type TEXT NOT NULL,
  analysis TEXT NOT NULL,
  portfolio_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, analysis_type)
);

-- Enable RLS
ALTER TABLE public.ai_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own AI analysis cache" 
ON public.ai_analysis_cache 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI analysis cache" 
ON public.ai_analysis_cache 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI analysis cache" 
ON public.ai_analysis_cache 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_ai_analysis_cache_user_type_created ON public.ai_analysis_cache(user_id, analysis_type, created_at DESC);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_ai_analysis_cache_updated_at
BEFORE UPDATE ON public.ai_analysis_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();