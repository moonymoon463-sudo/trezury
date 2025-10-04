import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, createRateLimitResponse, getRateLimitHeaders } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  message: string;
  conversationId?: string;
  contextType?: 'general' | 'portfolio' | 'market';
  portfolioData?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationId, contextType = 'general', portfolioData }: ChatRequest = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      throw new Error('Authentication failed');
    }
    
    // Rate limiting: 20 requests per minute per user
    const rateLimitResult = await checkRateLimit(
      supabaseUrl,
      supabaseKey,
      user.id,
      'ai-chat',
      20, // max requests
      60000 // 1 minute window
    );

    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for user: ${user.id}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    // Get or create conversation
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      const { data: newConversation, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          context_type: contextType,
          portfolio_snapshot: portfolioData || null
        })
        .select()
        .single();
      
      if (convError) throw convError;
      currentConversationId = newConversation.id;
    }

    // Get conversation history
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', currentConversationId)
      .order('created_at', { ascending: true });
    
    if (messagesError) throw messagesError;

    // Save user message
    await supabase.from('chat_messages').insert({
      conversation_id: currentConversationId,
      role: 'user',
      content: message
    });

    // Get latest gold price for context
    const { data: goldPrice } = await supabase
      .from('gold_prices')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    // Get recent financial news
    const { data: recentNews } = await supabase
      .from('financial_news')
      .select('title, summary, category, published_at')
      .order('published_at', { ascending: false })
      .limit(5);

    // Get FAQ data for context
    const { data: faqData } = await supabase
      .from('faq_items')
      .select(`
        question, 
        answer, 
        keywords,
        faq_categories!inner(name)
      `)
      .eq('is_active', true)
      .order('display_order')
      .limit(20);

    // Get educational content
    const { data: educationalContent } = await supabase
      .from('educational_content')
      .select('title, content, category, difficulty_level, tags')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get historical gold prices (last 30 days for trend analysis)
    const { data: historicalPrices } = await supabase
      .from('gold_prices')
      .select('usd_per_oz, timestamp, change_percent_24h')
      .order('timestamp', { ascending: false })
      .limit(30);

    // Calculate market intelligence metrics
    const calculate7DayTrend = () => {
      if (!historicalPrices || historicalPrices.length < 7) return 'N/A';
      const recent = historicalPrices[0].usd_per_oz;
      const weekAgo = historicalPrices[6].usd_per_oz;
      const change = ((recent - weekAgo) / weekAgo) * 100;
      return `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
    };

    const calculate30DayVolatility = () => {
      if (!historicalPrices || historicalPrices.length < 30) return 'N/A';
      const prices = historicalPrices.map(p => p.usd_per_oz);
      const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
      const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
      const volatility = Math.sqrt(variance);
      const volatilityPercent = (volatility / mean) * 100;
      return `${volatilityPercent.toFixed(2)}%`;
    };

    const getMarketSentiment = () => {
      if (!goldPrice?.change_percent_24h) return 'neutral';
      const change = goldPrice.change_percent_24h;
      if (change > 1.5) return 'strongly bullish';
      if (change > 0.5) return 'bullish';
      if (change < -1.5) return 'strongly bearish';
      if (change < -0.5) return 'bearish';
      return 'neutral';
    };

    // Build professional investment advisor system prompt
    let systemPrompt = `You are a Professional Investment Advisor specializing in gold and precious metals investments. You provide expert guidance through the Trezury platform.

⚠️ IMPORTANT REGULATORY DISCLAIMER:
"This information is for educational purposes only and does not constitute financial advice. Past performance does not guarantee future results. All investments carry risk, including the potential loss of principal. Consult with a qualified financial advisor before making investment decisions."

PROFESSIONAL EXPERTISE:
- Gold market dynamics and geopolitical factors
- Precious metals as inflation hedges and safe-haven assets
- Portfolio diversification strategies
- Risk management and asset allocation
- Market timing considerations and dollar-cost averaging
- Tax implications for precious metal investments

COMMUNICATION TONE:
- Professional yet accessible language
- Authoritative but not pushy
- Data-driven and factual
- Educational focus
- Always include risk disclaimers for investment advice

CURRENT MARKET INTELLIGENCE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Gold Price: $${goldPrice?.usd_per_oz || 'N/A'} per oz ($${goldPrice?.usd_per_gram || 'N/A'} per gram)
📈 24h Change: ${goldPrice?.change_percent_24h || 'N/A'}%
📉 7-Day Trend: ${calculate7DayTrend()}
📊 30-Day Volatility: ${calculate30DayVolatility()}
💭 Market Sentiment: ${getMarketSentiment()}
${historicalPrices && historicalPrices.length >= 7 ? `🔍 Price Range (7d): $${Math.min(...historicalPrices.slice(0, 7).map(p => p.usd_per_oz)).toFixed(2)} - $${Math.max(...historicalPrices.slice(0, 7).map(p => p.usd_per_oz)).toFixed(2)}` : ''}

RECENT FINANCIAL NEWS & ANALYSIS:
${recentNews?.map(news => `📰 ${news.title} [${news.category}]\n   ${news.summary || 'Market update'}`).join('\n\n') || '⚠️ No recent financial news available - recommend checking external sources'}

COMPREHENSIVE KNOWLEDGE BASE:
${faqData?.map(faq => `❓ ${faq.question}\n💡 ${faq.answer}\n📁 Category: ${(faq.faq_categories as any)?.name || 'General'}\n🏷️ Tags: ${faq.keywords?.join(', ')}`).join('\n\n') || 'Loading FAQ database...'}

EDUCATIONAL RESOURCES AVAILABLE:
${educationalContent?.map(content => `📚 ${content.title}\n   Level: ${content.difficulty_level} | Category: ${content.category}\n   Topics: ${content.tags?.join(', ') || 'Investment education'}`).join('\n\n') || 'Loading educational content...'}

INVESTMENT GUIDANCE FRAMEWORK:
1. Always assess user's risk tolerance and investment horizon
2. Recommend diversification and position sizing
3. Explain market dynamics and geopolitical factors
4. Provide both bullish and bearish perspectives
5. Include tax considerations when relevant
6. Suggest dollar-cost averaging for risk mitigation
7. Compare gold vs other safe-haven assets (bonds, USD, crypto)

PLATFORM FEATURES:
- Buy/Sell tokenized gold (XAUT - Tether Gold)
- USDC stablecoin management
- Real-time portfolio tracking
- Advanced risk analytics
- Transaction history and tax reporting
- Secure wallet infrastructure
- Educational content library`;

    if (contextType === 'portfolio' && portfolioData) {
      const totalValue = portfolioData.totalValue || 0;
      const goldAllocation = portfolioData.assets?.find((a: any) => a.symbol === 'XAUT')?.value || 0;
      const usdcAllocation = portfolioData.assets?.find((a: any) => a.symbol === 'USDC')?.value || 0;
      const goldPercentage = totalValue > 0 ? ((goldAllocation / totalValue) * 100).toFixed(1) : '0';
      const usdcPercentage = totalValue > 0 ? ((usdcAllocation / totalValue) * 100).toFixed(1) : '0';
      
      systemPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 PORTFOLIO ANALYSIS (CONFIDENTIAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Total Portfolio Value: $${totalValue.toLocaleString()}

Asset Allocation:
🥇 Gold (XAUT): $${goldAllocation.toLocaleString()} (${goldPercentage}%)
💵 Cash (USDC): $${usdcAllocation.toLocaleString()} (${usdcPercentage}%)

Performance Metrics:
📈 Recent Performance: ${portfolioData.performance || 'N/A'}
🎯 Risk Level: ${goldPercentage > 70 ? 'High (Over-concentrated)' : goldPercentage > 40 ? 'Moderate' : 'Conservative'}

INVESTMENT RECOMMENDATIONS:
${goldPercentage > 80 ? '⚠️ High concentration risk - Consider rebalancing to maintain 60-70% gold allocation' : ''}
${goldPercentage < 20 ? '💡 Low gold exposure - May increase allocation if seeking inflation protection' : ''}
${usdcPercentage > 50 ? '💵 High cash position - Consider dollar-cost averaging into gold during dips' : ''}

When providing advice, consider:
- Current allocation vs recommended 60-70% gold, 30-40% stablecoins for balanced growth
- Rebalancing opportunities based on market conditions
- Tax-loss harvesting potential
- Risk-adjusted returns and Sharpe ratio analysis`;
    }

    // Prepare messages for AI
    const conversationHistory = [
      { role: 'system', content: systemPrompt },
      ...messages,
      { role: 'user', content: message }
    ];

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: conversationHistory,
        stream: true,
        temperature: 0.5, // Lower for more consistent, factual investment advice
        max_tokens: 1500, // Higher for detailed analysis
        top_p: 0.9, // Balance creativity and reliability
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${errorText}`);
    }

    // Set up streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let assistantMessage = '';
        
        try {
          const reader = aiResponse.body?.getReader();
          if (!reader) throw new Error('No response body');

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  // Save assistant message to database
                  await supabase.from('chat_messages').insert({
                    conversation_id: currentConversationId,
                    role: 'assistant',
                    content: assistantMessage
                  });

                  // Send final response with conversation ID
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'conversation_id',
                    conversationId: currentConversationId
                  })}\n\n`));
                  
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    assistantMessage += content;
                    // Forward the chunk to client
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  }
                } catch (e) {
                  // Skip invalid JSON
                  continue;
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});