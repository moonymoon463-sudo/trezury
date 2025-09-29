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

    // Get historical gold prices (last 7 days)
    const { data: historicalPrices } = await supabase
      .from('gold_prices')
      .select('usd_per_oz, timestamp')
      .order('timestamp', { ascending: false })
      .limit(7);

    // Build enhanced context-aware system prompt
    let systemPrompt = `You are Trezury Advisor AI Assistant, an expert financial assistant specializing in gold investments, stablecoins (especially USDC), and digital asset management. You help users with their Trezury gold investment app.

CORE CAPABILITIES:
- Real-time gold market analysis and investment advice
- Financial news analysis and market insights
- FAQ assistance for common questions
- Educational content and personalized learning
- Portfolio optimization strategies
- App feature guidance and troubleshooting

CURRENT MARKET DATA:
- Gold price: $${goldPrice?.usd_per_oz || 'N/A'} per oz (${goldPrice?.usd_per_gram || 'N/A'} per gram)
- 24h change: ${goldPrice?.change_percent_24h || 'N/A'}%
${historicalPrices && historicalPrices.length > 1 ? `- 7-day trend: $${historicalPrices[6]?.usd_per_oz || 'N/A'} → $${historicalPrices[0]?.usd_per_oz || 'N/A'}` : ''}

RECENT FINANCIAL NEWS:
${recentNews?.map(news => `- ${news.title} (${news.category})`).join('\n') || 'No recent news available'}

FAQ KNOWLEDGE BASE:
${faqData?.map(faq => `Q: ${faq.question}\nA: ${faq.answer}\nCategory: ${(faq.faq_categories as any)?.name || 'General'}\nKeywords: ${faq.keywords?.join(', ')}`).join('\n\n') || 'FAQ data loading...'}

EDUCATIONAL CONTENT AVAILABLE:
${educationalContent?.map(content => `- ${content.title} (${content.difficulty_level}) - ${content.category}`).join('\n') || 'Educational content loading...'}

RESPONSE GUIDELINES:
- Answer FAQ-type questions directly using the knowledge base
- Provide market context using current news and price data
- Suggest relevant educational content when appropriate
- Offer personalized recommendations based on portfolio data
- Keep responses helpful, accurate, and actionable
- If you don't know something, acknowledge it and suggest alternatives

APP FEATURES YOU CAN HELP WITH:
- Buying and selling gold (XAUT tokens)
- Managing USDC stablecoin holdings
- Portfolio analysis and risk assessment
- Transaction history and tracking
- KYC verification process
- Wallet management and security
- Educational content and learning paths`;

    if (contextType === 'portfolio' && portfolioData) {
      systemPrompt += `\n\nCurrent user portfolio context:
- Total portfolio value: $${portfolioData.totalValue || 0}
- Assets: ${JSON.stringify(portfolioData.assets || [])}
- Recent performance: ${portfolioData.performance || 'N/A'}`;
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
        temperature: 0.7,
        max_tokens: 1000,
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