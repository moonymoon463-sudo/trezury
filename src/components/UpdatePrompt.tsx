import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

export const UpdatePrompt = () => {
  const { isUpdateAvailable, updateApp } = usePWA();

  if (!isUpdateAvailable) {
    return null;
  }

  return (
    <Card className="fixed top-4 left-4 right-4 z-50 p-4 bg-card border border-border shadow-lg md:left-auto md:right-4 md:w-80 animate-in slide-in-from-top">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-primary" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground mb-1">
            Update Available
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            A new version of Trezury is available with improvements and bug fixes.
          </p>
          
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={updateApp}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Update Now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};