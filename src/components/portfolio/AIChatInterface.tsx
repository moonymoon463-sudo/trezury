import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, MessageSquare, StopCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAIChat, ChatMessage } from '@/hooks/useAIChat';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';

// Helper function to format and sanitize message content
const formatMessageContent = (content: string) => {
  // Enhanced formatting for better readability
  let formatted = content
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-muted-foreground">$1</em>')
    .replace(/^• (.*)$/gm, '<div class="flex items-start gap-2 my-1"><span class="text-primary mt-1">•</span><span>$1</span></div>')
    .replace(/^- (.*)$/gm, '<div class="flex items-start gap-2 my-1"><span class="text-primary mt-1">•</span><span>$1</span></div>')
    .replace(/^\d+\. (.*)$/gm, '<div class="flex items-start gap-2 my-1"><span class="text-primary font-medium">$&</span></div>')
    .replace(/\n\n/g, '<div class="my-3"></div>')
    .replace(/\n/g, '<br />');

  // Format currency values
  formatted = formatted.replace(/\$[\d,]+\.?\d*/g, '<span class="font-medium text-green-600 dark:text-green-400">$&</span>');
  
  // Format percentages
  formatted = formatted.replace(/\d+\.?\d*%/g, '<span class="font-medium text-blue-600 dark:text-blue-400">$&</span>');

  // Sanitize HTML to prevent XSS attacks
  return DOMPurify.sanitize(formatted, {
    ALLOWED_TAGS: ['strong', 'em', 'div', 'span', 'br'],
    ALLOWED_ATTR: ['class'],
    KEEP_CONTENT: true
  });
};

interface AIChatInterfaceProps {
  portfolioData?: any;
  isCollapsed?: boolean;
  onToggle?: () => void;
  contextType?: string;
  initialQuickActions?: string[];
  pageMetadata?: {
    pageTitle: string;
    helpTopic: string;
    pagePath: string;
  };
}

const QuickActions = ({ onSend }: { onSend: (message: string) => void }) => {
  const quickQuestions = [
    "Analyze my portfolio",
    "Market insights",
    "Investment risks",
    "Gold strategy"
  ];

  const fullQuestions = [
    "Analyze my portfolio performance",
    "What's driving gold prices today?",
    "Are there any risks I should know about?",
    "How does gold fit in my overall strategy?"
  ];

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-medium text-muted-foreground mb-1">Quick questions</h4>
      <div className="grid grid-cols-2 gap-1.5">
        {quickQuestions.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="text-left text-xs h-8 px-2.5 font-normal border-border/40 hover:bg-muted/50 justify-start truncate"
            onClick={() => onSend(fullQuestions[index])}
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
};

const MessageBubble = React.memo(({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn(
      "flex gap-2 mb-3",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      <div className={cn(
        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted border border-border/30"
      )}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      
      <div className={cn(
        "flex-1 max-w-[85%] px-3 py-2 rounded-lg text-sm",
        isUser 
          ? "bg-primary text-primary-foreground ml-auto" 
          : "bg-muted/50 border border-border/20"
      )}>
        <div 
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(formatMessageContent(message.content), {
              ALLOWED_TAGS: ['strong', 'em', 'div', 'span', 'br', 'p', 'ul', 'ol', 'li'],
              ALLOWED_ATTR: ['class'],
              KEEP_CONTENT: false,
              FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
              FORBID_ATTR: ['onerror', 'onload', 'onclick']
            })
          }}
        />
        <div className={cn(
          "text-xs mt-1.5 opacity-60",
          isUser ? "text-right" : "text-left"
        )}>
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  );
});

export const AIChatInterface: React.FC<AIChatInterfaceProps> = ({
  portfolioData,
  isCollapsed = false,
  onToggle,
  contextType,
  initialQuickActions,
  pageMetadata
}) => {
  const [input, setInput] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const isNearBottomRef = useRef(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  
  const defaultQuickActions = [
    "Analyze my portfolio",
    "Market insights",
    "Investment risks",
    "Gold strategy"
  ];

  const quickActionsToUse = initialQuickActions || defaultQuickActions;
  
  const {
    messages,
    isLoading,
    isStreaming,
    sendMessage,
    stopStreaming
  } = useAIChat();

  // Check if user is near bottom
  const checkIfNearBottom = () => {
    if (!scrollRef.current) return;
    
    const scrollContainer = isMobile 
      ? scrollRef.current 
      : scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
    
    if (scrollContainer) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }
  };

  // Optimized auto-scroll with debouncing
  const scrollToBottom = (smooth = false) => {
    const bypass = isStreaming; // during streaming, always pin to bottom
    if (!bypass && !isNearBottomRef.current) return;
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (scrollRef.current) {
        const scrollContainer = isMobile 
          ? scrollRef.current 
          : scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        
        if (scrollContainer) {
          requestAnimationFrame(() => {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: smooth && !isStreaming ? 'smooth' : 'auto'
            });
          });
        }
      }
    }, isStreaming ? 100 : 0);
  };

  // Force scroll on new messages
  useEffect(() => {
    console.log('[AIChatInterface] Messages changed, scrolling. Count:', messages.length);
    isNearBottomRef.current = true; // Force scroll on new message
    scrollToBottom();
  }, [messages.length]);

  // While streaming, force pin to bottom on any content change
  useEffect(() => {
    if (isStreaming) {
      isNearBottomRef.current = true;
      scrollToBottom();
    }
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleSend = async (messageText?: string) => {
    const messageToSend = messageText || input.trim();
    if (!messageToSend || isStreaming) return;

    setInput('');
    setShowQuickActions(false);
    
    const context = contextType || (portfolioData ? 'portfolio' : 'general');
    await sendMessage(
      messageToSend, 
      context as any,
      portfolioData
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isCollapsed) {
    return (
      <Card className="shadow-sm border-border/50">
        <CardContent className="p-4">
          <Button
            onClick={onToggle}
            className="w-full h-10 text-sm font-normal"
            variant="outline"
          >
            <MessageSquare size={16} className="mr-2" />
            Chat with Trezury Advisor AI Assistant
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Get portfolio insights & investment guidance
          </p>
        </CardContent>
      </Card>
    );
  }

  // Render messages directly; streaming updates modify the last assistant message in-place
  // Debug logging for mobile
  console.log('[AIChatInterface] Messages:', messages.length, 'Streaming:', !!isStreaming);

  return (
    <Card className="flex flex-col shadow-sm border-border/50 h-full max-h-[calc(100svh-10rem)] sm:max-h-full overflow-hidden">
      {onToggle && (
        <Button
          onClick={onToggle}
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0 z-10"
        >
          ×
        </Button>
      )}
      <CardHeader className="pb-3 px-4 py-3 border-b border-border/30 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2 font-medium">
            <Bot size={16} className="text-primary" />
            Trezury Advisor AI Assistant
          </CardTitle>
          <div className="flex items-center gap-2">
            {portfolioData && (
              <Badge variant="secondary" className="text-xs px-2 py-1">
                Portfolio Mode
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
        {/* Messages Area - Use native scrolling on mobile for better performance */}
        {isMobile ? (
          <div 
            ref={scrollRef}
            onScroll={checkIfNearBottom}
            className={cn(
              "flex-1 flex flex-col overflow-y-auto px-4",
              "[-webkit-overflow-scrolling:touch]",
              "overscroll-behavior-y-contain",
              "min-h-0"
            )}
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center text-muted-foreground py-6">
                <Bot size={32} className="mb-2 opacity-40" />
                <h3 className="text-sm font-medium mb-1">Trezury Advisor AI Assistant</h3>
                <p className="text-xs max-w-xs leading-relaxed">
                  Ask about investments, portfolio analysis, or market insights.
                </p>
              </div>
            ) : (
              <div className="w-full py-3 pb-4">
                {messages.map((message) => {
                  console.log('[AIChatInterface] Rendering:', message.role, message.content.substring(0, 30));
                  return <MessageBubble key={message.id} message={message} />;
                })}
                {isStreaming && (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3 px-1">
                    <Loader2 size={14} className="animate-spin" />
                    Trezury Advisor AI Assistant is thinking...
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <ScrollArea 
            ref={scrollRef} 
            className="flex-1 min-h-0 px-4"
            onScrollCapture={checkIfNearBottom}
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-6">
                <Bot size={32} className="mb-2 opacity-40" />
                <h3 className="text-sm font-medium mb-1">Trezury Advisor AI Assistant</h3>
                <p className="text-xs max-w-xs leading-relaxed">
                  Ask about investments, portfolio analysis, or market insights.
                </p>
              </div>
            ) : (
              <div className="py-3">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {isStreaming && (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3 px-1">
                    <Loader2 size={14} className="animate-spin" />
                    Trezury Advisor AI Assistant is thinking...
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        )}

        {/* Quick Actions */}
        {showQuickActions && messages.length === 0 && (
          <div className="px-4 pb-3">
            <QuickActions onSend={handleSend} />
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border/30 p-3 bg-muted/20 flex-shrink-0">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isStreaming ? "Trezury Advisor AI Assistant is responding..." : "Ask about gold investments, portfolio advice..."}
              disabled={isStreaming}
              className="flex-1 text-sm h-9 bg-background border-border/50"
            />
            
            {isStreaming ? (
              <Button
                onClick={stopStreaming}
                variant="outline"
                size="sm"
                className="flex-shrink-0 h-9 w-9 p-0"
              >
                <StopCircle size={16} />
              </Button>
            ) : (
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                size="sm"
                className="flex-shrink-0 h-9 w-9 p-0"
              >
                <Send size={16} />
              </Button>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground mt-2 px-1">
            Press Enter to send • Shift+Enter for new line
          </div>
        </div>
      </CardContent>
    </Card>
  );
};