-- Create financial news table
CREATE TABLE public.financial_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  source TEXT NOT NULL,
  url TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  relevance_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create FAQ categories table
CREATE TABLE public.faq_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create FAQ items table
CREATE TABLE public.faq_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.faq_categories(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create educational content table
CREATE TABLE public.educational_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'article',
  difficulty_level TEXT NOT NULL DEFAULT 'beginner',
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  reading_time_minutes INTEGER,
  prerequisites TEXT[],
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user preferences table
CREATE TABLE public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_tolerance TEXT DEFAULT 'moderate',
  investment_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_content_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  notification_preferences JSONB DEFAULT '{}',
  ai_personalization_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.financial_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educational_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for financial_news (public read)
CREATE POLICY "Anyone can view financial news" 
ON public.financial_news 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage financial news" 
ON public.financial_news 
FOR ALL 
USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- RLS policies for FAQ (public read)
CREATE POLICY "Anyone can view FAQ categories" 
ON public.faq_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage FAQ categories" 
ON public.faq_categories 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Anyone can view FAQ items" 
ON public.faq_items 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage FAQ items" 
ON public.faq_items 
FOR ALL 
USING (is_admin(auth.uid()));

-- RLS policies for educational content (public read)
CREATE POLICY "Anyone can view educational content" 
ON public.educational_content 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage educational content" 
ON public.educational_content 
FOR ALL 
USING (is_admin(auth.uid()));

-- RLS policies for user preferences
CREATE POLICY "Users can manage their own preferences" 
ON public.user_preferences 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_financial_news_published_at ON public.financial_news(published_at DESC);
CREATE INDEX idx_financial_news_category ON public.financial_news(category);
CREATE INDEX idx_faq_items_keywords ON public.faq_items USING GIN(keywords);
CREATE INDEX idx_educational_content_category ON public.educational_content(category);
CREATE INDEX idx_educational_content_difficulty ON public.educational_content(difficulty_level);

-- Insert default FAQ categories
INSERT INTO public.faq_categories (name, description, display_order) VALUES
('Getting Started', 'Basic questions about using Trezury and gold investing', 1),
('Gold Investing', 'Questions about gold markets, XAUT tokens, and investment strategies', 2),
('App Features', 'How to use specific features of the Trezury app', 3),
('Security & KYC', 'Account security, verification, and privacy questions', 4),
('Transactions', 'Buying, selling, deposits, withdrawals, and fees', 5),
('Technical Support', 'Troubleshooting and technical issues', 6);

-- Insert sample FAQ items
INSERT INTO public.faq_items (category_id, question, answer, keywords, display_order) VALUES
((SELECT id FROM public.faq_categories WHERE name = 'Getting Started'), 
 'What is Trezury?', 
 'Trezury is a digital platform that allows you to invest in physical gold through blockchain technology. You can buy, hold, and sell gold-backed tokens (XAUT) alongside stablecoins (USDC) in a secure, regulated environment.',
 ARRAY['trezury', 'gold', 'investing', 'XAUT', 'blockchain'], 1),
 
((SELECT id FROM public.faq_categories WHERE name = 'Getting Started'), 
 'How do I get started with Trezury?', 
 'To get started: 1) Create your account, 2) Complete KYC verification, 3) Add USDC to your account, 4) Start buying gold tokens (XAUT). Our AI assistant can guide you through each step.',
 ARRAY['getting started', 'account', 'kyc', 'verification'], 2),

((SELECT id FROM public.faq_categories WHERE name = 'Gold Investing'), 
 'What are XAUT tokens?', 
 'XAUT (Tether Gold) tokens are ERC-20 tokens on the Ethereum blockchain, where each token represents one troy ounce of physical gold stored in secure vaults. They combine the benefits of gold ownership with the convenience of digital assets.',
 ARRAY['XAUT', 'gold tokens', 'tether gold', 'physical gold'], 1),

((SELECT id FROM public.faq_categories WHERE name = 'Security & KYC'), 
 'Is my personal information secure?', 
 'Yes, we use bank-grade encryption and security measures. Your personal information is protected with advanced encryption, secure data storage, and strict access controls. We comply with all regulatory requirements for data protection.',
 ARRAY['security', 'encryption', 'privacy', 'data protection'], 1);

-- Insert sample educational content
INSERT INTO public.educational_content (title, content, content_type, difficulty_level, category, tags, reading_time_minutes) VALUES
('Gold Investing Basics', 
 'Gold has been a store of value for thousands of years. In modern portfolios, gold serves as a hedge against inflation and economic uncertainty. Digital gold tokens like XAUT allow you to own gold without the storage and insurance costs of physical gold.',
 'article', 'beginner', 'investing', ARRAY['gold', 'basics', 'portfolio', 'hedging'], 3),

('Understanding Portfolio Allocation', 
 'A well-balanced portfolio typically includes 5-10% allocation to gold. This helps reduce overall portfolio volatility while maintaining growth potential. The exact allocation depends on your risk tolerance and investment goals.',
 'guide', 'intermediate', 'portfolio', ARRAY['allocation', 'diversification', 'risk management'], 5),

('How Blockchain Gold Works', 
 'Blockchain-based gold tokens are backed by real, physical gold stored in audited vaults. Each token represents ownership of a specific amount of gold, making it easy to trade, transfer, and hold without physical storage concerns.',
 'article', 'beginner', 'technology', ARRAY['blockchain', 'gold tokens', 'XAUT', 'custody'], 4);

-- Create trigger for updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_financial_news_updated_at BEFORE UPDATE ON public.financial_news FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_faq_categories_updated_at BEFORE UPDATE ON public.faq_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_faq_items_updated_at BEFORE UPDATE ON public.faq_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_educational_content_updated_at BEFORE UPDATE ON public.educational_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();