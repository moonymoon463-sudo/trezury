import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Build context-aware system prompt
    let systemPrompt = `You are Trezury Advisor, an expert financial assistant specializing in gold investments, stablecoins (especially USDC), and digital asset management. You help users with their Trezury gold investment app.

Key capabilities:
- Provide real-time gold market analysis and investment advice
- Explain stablecoin (USDC) benefits and use cases
- Guide users through app features and functionalities
- Offer portfolio optimization strategies
- Answer questions about gold-backed tokens (XAUT) and treasury tokens (TRZRY)

Current market data:
- Gold price: $${goldPrice?.usd_per_oz || 'N/A'} per oz (${goldPrice?.usd_per_gram || 'N/A'} per gram)
- 24h change: ${goldPrice?.change_percent_24h || 'N/A'}%

App features you can help with:
- Buying and selling gold (XAUT tokens)
- Managing USDC stablecoin holdings
- Portfolio analysis and risk assessment
- Transaction history and tracking
- KYC verification process
- Wallet management and security

Always provide accurate, helpful, and actionable advice. Keep responses concise but informative.`;

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