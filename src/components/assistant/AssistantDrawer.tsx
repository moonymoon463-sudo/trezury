import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAssistant } from '@/contexts/AssistantContext';
import { AIChatInterface } from '@/components/portfolio/AIChatInterface';
import { Sparkles } from 'lucide-react';

export const AssistantDrawer = () => {
  const { isAssistantOpen, closeAssistant, currentContext } = useAssistant();

  return (
    <Sheet open={isAssistantOpen} onOpenChange={closeAssistant}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Trezury Assistant
          </SheetTitle>
          <p className="text-sm text-muted-foreground mt-1">
            I'm here to help you with {currentContext.helpTopic.toLowerCase()}
          </p>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <AIChatInterface
            isCollapsed={false}
            contextType={currentContext.page as any}
            initialQuickActions={currentContext.quickActions}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
