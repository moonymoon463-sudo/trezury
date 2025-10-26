import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ConnectionHealthBannerProps {
  isConnected: boolean;
  reconnectAttempts: number;
  maxAttempts: number;
}

export function ConnectionHealthBanner({ 
  isConnected, 
  reconnectAttempts, 
  maxAttempts 
}: ConnectionHealthBannerProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show banner if disconnected or reconnecting
    setShow(!isConnected && reconnectAttempts > 0);
  }, [isConnected, reconnectAttempts]);

  if (!show) return null;

  return (
    <Alert 
      variant="default" 
      className="border-yellow-500/50 bg-yellow-500/10 text-yellow-500 mb-4"
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          {reconnectAttempts < maxAttempts 
            ? `Reconnecting to market data... (${reconnectAttempts}/${maxAttempts})`
            : 'Connection lost. Please refresh the page.'}
        </span>
        {isConnected ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
      </AlertDescription>
    </Alert>
  );
}
