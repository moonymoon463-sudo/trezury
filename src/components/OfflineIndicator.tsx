import { WifiOff, Wifi } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const OfflineIndicator = () => {
  const { isOffline } = usePWA();

  if (!isOffline) return null;

  return (
    <Alert className="fixed top-4 left-4 right-4 z-40 bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800 md:left-auto md:right-4 md:w-80">
      <WifiOff className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-800 dark:text-orange-200">
        You're offline. Some features may be limited, but you can still view your cached data.
      </AlertDescription>
    </Alert>
  );
};