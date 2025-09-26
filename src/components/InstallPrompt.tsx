import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone, Share, Home, Star } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';
import { useState } from 'react';

export const InstallPrompt = () => {
  const { isInstallable, installApp, dismissInstallPrompt, isInstalled } = usePWA();
  const [isIOS] = useState(/iPad|iPhone|iPod/.test(navigator.userAgent));

  if (!isInstallable || isInstalled) {
    return null;
  }

  return (
    <Card className="fixed bottom-24 left-4 right-4 z-40 p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom md:left-auto md:right-4 md:w-96">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <Smartphone className="w-6 h-6 text-primary-foreground" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-foreground">
              Install Trezury
            </h3>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-primary text-primary" />
              ))}
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            {isIOS 
              ? "Get the full app experience! Tap Share → Add to Home Screen for instant access to your gold portfolio."
              : "Install our secure app for offline access, faster loading, and native mobile features."
            }
          </p>

          {isIOS && (
            <div className="mb-3 p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Share className="w-3 h-3" />
                <span>Tap</span>
                <div className="w-4 h-4 bg-primary/20 rounded flex items-center justify-center">
                  <Share className="w-2 h-2" />
                </div>
                <span>then</span>
                <div className="flex items-center gap-1">
                  <Home className="w-3 h-3" />
                  <span>Add to Home Screen</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            {!isIOS && (
              <Button 
                size="sm" 
                onClick={installApp}
                className="text-xs font-semibold"
              >
                <Download className="w-3 h-3 mr-1" />
                Install App
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={dismissInstallPrompt}
              className="text-xs"
            >
              Maybe Later
            </Button>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={dismissInstallPrompt}
          className="flex-shrink-0 p-1 h-auto hover:bg-destructive/20 hover:text-destructive"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
};