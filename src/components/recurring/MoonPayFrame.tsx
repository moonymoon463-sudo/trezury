import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MoonPayFrameProps {
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export const MoonPayFrame = ({ 
  url, 
  open, 
  onOpenChange, 
  onComplete,
  onError 
}: MoonPayFrameProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open) {
      setLoading(true);
      setError(null);
    }
  }, [open]);

  const handleIframeLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    const errorMsg = 'Failed to load MoonPay. Please try again.';
    setError(errorMsg);
    setLoading(false);
    onError?.(errorMsg);
  };

  const openInNewWindow = () => {
    window.open(url, '_blank', 'width=500,height=700,scrollbars=yes,resizable=yes');
    onOpenChange(false);
  };

  // Listen for messages from MoonPay iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from MoonPay domains
      if (!event.origin.includes('moonpay.com')) return;

      console.log('MoonPay message received:', event.data);

      // Handle different message types from MoonPay
      if (event.data?.type === 'moonpay_transaction_completed') {
        onComplete?.();
        onOpenChange(false);
      } else if (event.data?.type === 'moonpay_close') {
        onOpenChange(false);
      }
    };

    if (open) {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [open, onComplete, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">MoonPay</span>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={openInNewWindow}
              className="h-8 w-8 p-0"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="relative h-[600px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 mx-auto animate-spin" />
                <p className="text-sm text-muted-foreground">Loading MoonPay...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background p-4">
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="space-y-3">
                    <p>{error}</p>
                    <Button 
                      onClick={openInNewWindow}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in new window
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={url}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title="MoonPay"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            Secure payment processing by MoonPay. 
            Having issues? <button 
              onClick={openInNewWindow}
              className="text-primary hover:underline"
            >
              Open in new window
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};