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
    if (!session?.access_token || !content.trim()) return;

    // Cancel any ongoing stream
    if (abortControllerRef.current) {
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

      // Prepare request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const response = await fetch(`https://auntkvllzejtfqmousxg.supabase.co/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          message: content.trim(),
          conversationId: currentConversationId,
          contextType,
          portfolioData
        }),
        signal: abortController.signal,
        cache: 'no-store',
        keepalive: true
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
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

      // Throttle UI updates to prevent jank on mobile
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
          setTimeout(flushUI, 100);
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
        console.log('Request was aborted');
        return;
      }
      
      console.error('Error sending message:', error);
      
      // Add error message or update assistant placeholder if present
      const fallbackContent = 'I apologize, but I encountered an error while processing your request. Please try again.';
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