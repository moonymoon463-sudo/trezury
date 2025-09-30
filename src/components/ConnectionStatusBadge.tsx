import { useSupabaseConnection } from '@/hooks/useSupabaseConnection';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const ConnectionStatusBadge = () => {
  const { status } = useSupabaseConnection();

  if (!status.sessionValid) {
    // User not logged in - don't show badge
    return null;
  }

  const getStatusInfo = () => {
    if (!status.isConnected) {
      return {
        variant: 'destructive' as const,
        icon: WifiOff,
        text: 'Disconnected',
        tooltip: 'Connection lost. Attempting to reconnect...',
      };
    }

    if (!status.isHealthy) {
      return {
        variant: 'destructive' as const,
        icon: AlertTriangle,
        text: 'Unhealthy',
        tooltip: status.error || 'Connection issues detected',
      };
    }

    if (status.minutesUntilExpiry !== null && status.minutesUntilExpiry <= 5) {
      return {
        variant: 'secondary' as const,
        icon: AlertTriangle,
        text: 'Refreshing',
        tooltip: `Session expires in ${status.minutesUntilExpiry} minute(s)`,
      };
    }

    return {
      variant: 'outline' as const,
      icon: Wifi,
      text: 'Connected',
      tooltip: 'Connection healthy',
    };
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  // Only show badge if there's an issue
  if (status.isConnected && status.isHealthy && (status.minutesUntilExpiry === null || status.minutesUntilExpiry > 5)) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={statusInfo.variant} className="gap-1">
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{statusInfo.text}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{statusInfo.tooltip}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Last checked: {status.lastChecked.toLocaleTimeString()}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
