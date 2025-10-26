import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAssistant } from '@/contexts/AssistantContext';
import { AIChatInterface } from '@/components/portfolio/AIChatInterface';
import { Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const AssistantDrawer = () => {
  const location = useLocation();
  const { isAssistantOpen, openAssistant, closeAssistant, currentContext } = useAssistant();

  // Don't show on trading dashboard
  if (location.pathname.includes('/trading-dashboard')) {
    return null;
  }

  return (
    <Sheet open={isAssistantOpen} onOpenChange={(open) => open ? openAssistant() : closeAssistant()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-lg p-0 flex flex-col h-[calc(100svh)] sm:h-[95vh] sm:mt-0 pt-[env(safe-area-inset-top)] data-[state=open]:duration-0 data-[state=closed]:duration-0"
      >
        <SheetHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Trezury Assistant
          </SheetTitle>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            I'm here to help you with {currentContext.helpTopic.toLowerCase()}
          </p>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden min-h-0">
          <AIChatInterface
            isCollapsed={false}
            contextType={currentContext.page as any}
            initialQuickActions={currentContext.quickActions}
            pageMetadata={{
              pageTitle: currentContext.pageTitle,
              helpTopic: currentContext.helpTopic,
              pagePath: currentContext.page
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
