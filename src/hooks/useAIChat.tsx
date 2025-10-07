import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChatConversation {
  id: string;
  title: string;
  contextType: 'general' | 'portfolio' | 'market';
  updatedAt: Date;
}

export const useAIChat = () => {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('id, title, context_type, updated_at')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setConversations(data.map(conv => ({
        id: conv.id,
        title: conv.title || 'New Conversation',
        contextType: conv.context_type as 'general' | 'portfolio' | 'market',
        updatedAt: new Date(conv.updated_at)
      })));
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }, [session?.access_token]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!session?.access_token) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: new Date(msg.created_at)
      })));

      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  // Send a message
  const sendMessage = useCallback(async (
    content: string, 
    contextType: 'general' | 'portfolio' | 'market' = 'general',
    portfolioData?: any
  ) => {
    if (!content.trim()) {
      console.warn('⚠️ Empty message, skipping send');
      return;
    }

    if (!session?.access_token) {
      console.error('❌ No session access token available');
      return;
    }

    console.log('🚀 Sending message:', {
      messageLength: content.length,
      hasSession: !!session?.access_token,
      conversationId: currentConversationId,
      contextType
    });

    // Cancel any ongoing stream
    if (abortControllerRef.current) {
      console.log('🛑 Aborting previous stream');
      abortControllerRef.current.abort();
    }

    let assistantId: string | null = null;
    try {
      setIsStreaming(true);
      
      // Add user message immediately
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      console.log('✅ User message added to UI');

      // Prepare request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const requestBody = {
        message: content.trim(),
        conversationId: currentConversationId,
        contextType,
        portfolioData
      };

      console.log('📤 Fetching AI response...', {
        url: 'https://auntkvllzejtfqmousxg.supabase.co/functions/v1/ai-chat',
        hasAuth: !!session.access_token,
        bodySize: JSON.stringify(requestBody).length,
        isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      });

      // Mobile-specific timeout: 10 seconds for initial response
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const timeout = isMobile ? 10000 : 30000;
      
      const timeoutId = setTimeout(() => {
        console.warn('⏱️ Request timeout reached');
        abortController.abort();
      }, timeout);

      let response: Response;
      try {
        response = await fetch(`https://auntkvllzejtfqmousxg.supabase.co/functions/v1/ai-chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
          cache: 'no-store'
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout - network may be slow. Please try again.');
        }
        throw fetchError;
      }

      console.log('📥 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries([...response.headers.entries()])
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Prepare assistant placeholder and attempt streaming
      let assistantContent = '';
      assistantId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Try streaming via ReadableStream; fallback to full text if not supported
      const reader = response.body?.getReader();
      if (!reader) {
        // Non-stream fallback: reconstruct events from full text
        const fullText = await response.text();
        const text = fullText.replace(/\r\n/g, '\n');
        let eventData = '';
        for (const rawLine of text.split('\n')) {
          const line = rawLine.trimEnd();
          if (line === '') {
            if (eventData) {
              try {
                const parsed = JSON.parse(eventData);
                if (parsed.type === 'conversation_id') {
                  setCurrentConversationId(parsed.conversationId);
                  await loadConversations();
                } else {
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) assistantContent += delta;
                }
              } catch {}
              eventData = '';
            }
            continue;
          }
          if (line.startsWith('data:')) {
            const piece = line.slice(5).trimStart();
            if (piece === '[DONE]') break;
            eventData += (eventData ? '\n' : '') + piece;
          }
        }
        if (assistantId) {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
        }
        return;
      }

      // Streaming path with mobile-safe SSE parser
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let eventData = '';
      let doneStreaming = false;

      // Adaptive UI update throttling - faster on desktop, slower on mobile
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const throttleDelay = isMobileDevice ? 150 : 50;
      
      let pendingFlush = false;
      const flushUI = () => {
        pendingFlush = false;
        if (assistantId) {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
        }
      };
      const scheduleFlush = () => {
        if (!pendingFlush) {
          pendingFlush = true;
          setTimeout(flushUI, throttleDelay);
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let nl;
          while ((nl = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            line = line.replace(/\r$/, '');

            if (line === '') {
              // Blank line = event boundary
              if (eventData) {
                try {
                  if (eventData === '[DONE]') {
                    doneStreaming = true;
                    break;
                  }
                  const parsed = JSON.parse(eventData);
                  if (parsed.type === 'conversation_id') {
                    setCurrentConversationId(parsed.conversationId);
                    await loadConversations();
                  } else {
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                      assistantContent += delta;
                      scheduleFlush();
                    }
                  }
                } catch {}
                eventData = '';
              }
              continue;
            }

            if (line.startsWith('data:')) {
              const piece = line.slice(5).trimStart();
              if (piece === '[DONE]') {
                doneStreaming = true;
                break;
              }
              eventData += (eventData ? '\n' : '') + piece;
            }
          }

          if (doneStreaming) break;
        }

        // Flush remaining decoder state and process tail
        buffer += decoder.decode();
        if (buffer.length) {
          const tail = buffer.replace(/\r\n/g, '\n').split('\n');
          for (const rawLine of tail) {
            const line = rawLine.trimEnd();
            if (line === '') {
              if (eventData) {
                try {
                  if (eventData !== '[DONE]') {
                    const parsed = JSON.parse(eventData);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) assistantContent += delta;
                  }
                } catch {}
                eventData = '';
              }
            } else if (line.startsWith('data:')) {
              const piece = line.slice(5).trimStart();
              if (piece === '[DONE]') break;
              eventData += (eventData ? '\n' : '') + piece;
            }
          }
        }

        // Final UI sync
        if (assistantId) {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
        }
      } finally {
        try { reader.releaseLock(); } catch {}
      }


    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('⏹️ Request was aborted by user');
        return;
      }
      
      console.error('❌ Error sending message:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Determine user-friendly error message
      let fallbackContent = 'I apologize, but I encountered an error while processing your request. ';
      
      if (error.message.includes('timeout')) {
        fallbackContent += 'The request timed out. This often happens on slower mobile connections. Please try again.';
      } else if (error.message.includes('429')) {
        fallbackContent += 'The AI service is currently rate limited. Please try again in a moment.';
      } else if (error.message.includes('402')) {
        fallbackContent += 'The AI service requires additional credits. Please contact support.';
      } else if (error.message.includes('401') || error.message.includes('403')) {
        fallbackContent += 'Authentication failed. Please try logging out and back in.';
      } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        fallbackContent += 'Network connection issue. Please check your internet connection and try again.';
      } else {
        fallbackContent += 'Please try again or contact support if the issue persists.';
      }
      
      // Add error message or update assistant placeholder if present
      if (assistantId) {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fallbackContent } : m));
      } else {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fallbackContent,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      console.log('🏁 Message send completed');
    }
  }, [session?.access_token, currentConversationId, loadConversations]);

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
  }, []);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  return {
    messages,
    conversations,
    currentConversationId,
    isLoading,
    isStreaming,
    sendMessage,
    loadConversations,
    loadMessages,
    startNewConversation,
    stopStreaming
  };
};