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
        const fullText = await response.text();
        let buffered = '';
        const chunks = fullText.replace(/\r\n/g, '\n').split('\n');
        for (const raw of chunks) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'conversation_id') {
              setCurrentConversationId(parsed.conversationId);
              await loadConversations();
              continue;
            }
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) buffered += delta;
          } catch {}
        }
        if (assistantId) {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: buffered } : m));
        }
        return;
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let doneStreaming = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let lineBreakIndex;
        while ((lineBreakIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, lineBreakIndex);
          buffer = buffer.slice(lineBreakIndex + 1);

          line = line.replace(/\r$/, '').trim();

          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data) continue;

          if (data === '[DONE]') {
            doneStreaming = true;
            break;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'conversation_id') {
              setCurrentConversationId(parsed.conversationId);
              await loadConversations();
              continue;
            }

            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              if (assistantId) {
                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
              }
            }
          } catch {
            // Ignore partial JSON; it will be completed in subsequent chunks
          }
        }

        if (doneStreaming) break;
      }

      // Flush any remaining buffered line (without trailing newline)
      if (buffer.length) {
        try {
          const maybeLine = buffer.trim();
          if (maybeLine.startsWith('data:')) {
            const data = maybeLine.slice(5).trim();
            if (data && data !== '[DONE]') {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                assistantContent += delta;
                if (assistantId) {
                  setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
                }
              }
            }
          }
        } catch {
          // ignore
        }
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