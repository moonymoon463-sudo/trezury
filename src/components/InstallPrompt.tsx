import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running as PWA
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    
    // Check if iOS
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show iOS prompt after delay if on iOS and not standalone
    if (isIOS && !isStandalone) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isIOS, isStandalone]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    }
  };

  const handleClose = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem('installPromptDismissed', 'true');
  };

  // Don't show if already dismissed this session or running as PWA
  if (!showPrompt || isStandalone || sessionStorage.getItem('installPromptDismissed')) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 p-4 bg-card border border-border shadow-lg md:left-auto md:right-4 md:w-80">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground mb-1">
            Install Trezury App
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {isIOS 
              ? "Tap the share button and select 'Add to Home Screen' to install the app."
              : "Install our app for quick access to your gold wallet."
            }
          </p>
          
          <div className="flex gap-2">
            {!isIOS && deferredPrompt && (
              <Button 
                size="sm" 
                onClick={handleInstallClick}
                className="text-xs"
              >
                <Download className="w-3 h-3 mr-1" />
                Install
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClose}
              className="text-xs"
            >
              Later
            </Button>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleClose}
          className="flex-shrink-0 p-1 h-auto"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
};