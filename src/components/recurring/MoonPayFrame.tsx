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
      <DialogContent className="max-w-full w-screen h-screen sm:max-w-[98vw] sm:h-[98vh] p-0 gap-0 border-0">
        {/* Minimal overlay controls */}
        <div className="absolute top-2 right-2 z-50 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={openInNewWindow}
            className="h-9 w-9 p-0 shadow-lg"
            title="Open in new window"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-9 w-9 p-0 shadow-lg"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="relative w-full h-full">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 mx-auto animate-spin" />
                <p className="text-sm text-muted-foreground">Loading MoonPay...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background p-4 z-10">
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
      </DialogContent>
    </Dialog>
  );
};