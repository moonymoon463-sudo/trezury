import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PortfolioAnalysisRequest {
  message: string;
  context?: string;
  portfolioData?: {
    balances: Array<{ asset: string; amount: number; chain: string }>;
    totalValue: number;
    goldPrice: number;
    userId: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context, portfolioData }: PortfolioAnalysisRequest = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    // Initialize Supabase client for auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid auth token');
    }

    // Check for cached analysis if context is portfolio_analysis
    let cachedAnalysis = null;
    if (context === 'portfolio_analysis' && portfolioData) {
      const { data: cached } = await supabase
        .from('ai_analysis_cache')
        .select('analysis, created_at')
        .eq('user_id', user.id)
        .eq('analysis_type', 'portfolio')
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5 min cache
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (cached) {
        cachedAnalysis = cached.analysis;
      }
    }

    // Return cached analysis if available
    if (cachedAnalysis) {
      return new Response(JSON.stringify({ 
        response: cachedAnalysis,
        cached: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare enhanced prompt for portfolio analysis
    let enhancedMessage = message;
    if (context === 'portfolio_analysis' && portfolioData) {
      const { balances, totalValue, goldPrice } = portfolioData;
      
      const usdcBalance = balances.find(b => b.asset === 'USDC')?.amount || 0;
      const xautBalance = balances.find(b => b.asset === 'XAUT')?.amount || 0;
      const trzryBalance = balances.find(b => b.asset === 'TRZRY')?.amount || 0;
      
      const usdcValue = usdcBalance;
      const xautValue = xautBalance * goldPrice;
      const totalPortfolioValue = usdcValue + xautValue;
      
      const goldAllocation = totalPortfolioValue > 0 ? (xautValue / totalPortfolioValue) * 100 : 0;
      const usdcAllocation = totalPortfolioValue > 0 ? (usdcValue / totalPortfolioValue) * 100 : 0;

      enhancedMessage = `
PORTFOLIO ANALYSIS REQUEST

Portfolio Summary:
- Total Value: $${totalValue.toFixed(2)}
- USDC Balance: ${usdcBalance.toFixed(4)} ($${usdcValue.toFixed(2)}) - ${usdcAllocation.toFixed(1)}%
- XAUT Balance: ${xautBalance.toFixed(6)} oz ($${xautValue.toFixed(2)}) - ${goldAllocation.toFixed(1)}%
- TRZRY Balance: ${trzryBalance.toFixed(4)}
- Current Gold Price: $${goldPrice.toFixed(2)}/oz

Please provide:
1. Risk assessment (concentration, volatility, market exposure)
2. Portfolio optimization recommendations
3. Market forecasts for next 7-30 days
4. Actionable insights with specific steps
5. Asset allocation recommendations

Focus on actionable, personalized advice based on current market conditions and portfolio composition.
`;
    }

    // Call Lovable AI Gateway
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('Lovable API key not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a sophisticated financial AI assistant specializing in portfolio analysis, risk assessment, and investment optimization. Provide actionable, personalized advice with specific recommendations and confidence levels.'
          },
          {
            role: 'user',
            content: enhancedMessage
          }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI Gateway error: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content;

    if (!analysis) {
      throw new Error('No response from AI model');
    }

    // Cache the analysis if it's portfolio analysis
    if (context === 'portfolio_analysis' && portfolioData) {
      await supabase
        .from('ai_analysis_cache')
        .upsert({
          user_id: user.id,
          analysis_type: 'portfolio',
          analysis: analysis,
          portfolio_snapshot: portfolioData,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,analysis_type'
        });
    }

    return new Response(JSON.stringify({ 
      response: analysis,
      cached: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to generate AI analysis' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});