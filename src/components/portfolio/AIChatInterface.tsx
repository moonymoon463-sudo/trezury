import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, MessageSquare, StopCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAIChat, ChatMessage } from '@/hooks/useAIChat';
import { useEnhancedAI } from '@/hooks/useEnhancedAI';
import { cn } from '@/lib/utils';

// Helper function to format message content with enhanced readability
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

  return formatted;
};

interface AIChatInterfaceProps {
  portfolioData?: any;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const QuickActions = ({ onSend }: { onSend: (message: string) => void }) => {
  const portfolioQuestions = [
    { icon: "📊", text: "Analyze my portfolio performance", color: "text-emerald-600" },
    { icon: "💡", text: "What investment opportunities do you see?", color: "text-blue-600" },
    { icon: "⚠️", text: "Are there any risks I should know about?", color: "text-amber-600" },
    { icon: "📈", text: "How does gold fit in my overall strategy?", color: "text-purple-600" }
  ];

  const marketQuestions = [
    { icon: "🌍", text: "What's driving gold prices today?", color: "text-green-600" },
    { icon: "📉", text: "Is this a good time to buy?", color: "text-red-600" },
    { icon: "🔮", text: "What's your gold price forecast?", color: "text-indigo-600" },
    { icon: "💰", text: "How do interest rates affect gold?", color: "text-yellow-600" }
  ];

  const educationQuestions = [
    { icon: "🎓", text: "Teach me about dollar-cost averaging", color: "text-teal-600" },
    { icon: "🏛️", text: "How do central bank policies affect gold?", color: "text-slate-600" },
    { icon: "⚖️", text: "What are the risks of gold investing?", color: "text-orange-600" },
    { icon: "🌟", text: "Why should I consider digital gold?", color: "text-cyan-600" }
  ];

  return (
    <div className="space-y-4">
      {/* Portfolio Questions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <h4 className="text-sm font-medium text-foreground">Portfolio Insights</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {portfolioQuestions.map((question, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              className="h-auto p-3 text-left justify-start border border-border/40 hover:border-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-all duration-200 group"
              onClick={() => onSend(question.text)}
            >
              <div className="flex flex-col items-start gap-1.5 w-full">
                <span className={`text-lg ${question.color} group-hover:scale-110 transition-transform duration-200`}>
                  {question.icon}
                </span>
                <span className="text-xs font-medium leading-tight text-foreground/90 text-left">
                  {question.text}
                </span>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Market Questions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <h4 className="text-sm font-medium text-foreground">Market Analysis</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {marketQuestions.map((question, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              className="h-auto p-3 text-left justify-start border border-border/40 hover:border-blue-200 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all duration-200 group"
              onClick={() => onSend(question.text)}
            >
              <div className="flex flex-col items-start gap-1.5 w-full">
                <span className={`text-lg ${question.color} group-hover:scale-110 transition-transform duration-200`}>
                  {question.icon}
                </span>
                <span className="text-xs font-medium leading-tight text-foreground/90 text-left">
                  {question.text}
                </span>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Education Questions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
          <h4 className="text-sm font-medium text-foreground">Learning Center</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {educationQuestions.map((question, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              className="h-auto p-3 text-left justify-start border border-border/40 hover:border-purple-200 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-all duration-200 group"
              onClick={() => onSend(question.text)}
            >
              <div className="flex flex-col items-start gap-1.5 w-full">
                <span className={`text-lg ${question.color} group-hover:scale-110 transition-transform duration-200`}>
                  {question.icon}
                </span>
                <span className="text-xs font-medium leading-tight text-foreground/90 text-left">
                  {question.text}
                </span>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({ message }: { message: ChatMessage }) => {
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
          dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }}
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
};

export const AIChatInterface: React.FC<AIChatInterfaceProps> = ({
  portfolioData,
  isCollapsed = false,
  onToggle
}) => {
  const [input, setInput] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    messages,
    isLoading,
    isStreaming,
    sendMessage,
    stopStreaming
  } = useAIChat();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const messageToSend = messageText || input.trim();
    if (!messageToSend || isStreaming) return;

    setInput('');
    setShowQuickActions(false);
    
    await sendMessage(
      messageToSend, 
      portfolioData ? 'portfolio' : 'general',
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

  return (
    <Card className="h-[500px] flex flex-col shadow-sm border-border/50">{onToggle && (
        <Button
          onClick={onToggle}
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0 z-10"
        >
          ×
        </Button>
      )}
      <CardHeader className="pb-3 px-4 py-3 border-b border-border/30">
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
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4">
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
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Quick Actions */}
        {showQuickActions && messages.length === 0 && (
          <div className="px-4 pb-3">
            <QuickActions onSend={handleSend} />
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border/30 p-3 bg-muted/20">
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