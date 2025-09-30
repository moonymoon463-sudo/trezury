import { AlertTriangle, Activity, WifiOff } from 'lucide-react';
import { useSupabaseHealth } from '@/hooks/useSupabaseHealth';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const SupabaseHealthIndicator = () => {
  const { status, isEmergencyMode } = useSupabaseHealth();

  // Only show indicator when not healthy
  if (status === 'healthy') return null;

  const config = {
    degraded: {
      icon: Activity,
      className: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
      iconClassName: 'h-4 w-4 text-yellow-600',
      textClassName: 'text-yellow-800 dark:text-yellow-200',
      message: 'Service is running slower than usual. Some features may be delayed.',
    },
    unhealthy: {
      icon: isEmergencyMode ? WifiOff : AlertTriangle,
      className: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
      iconClassName: 'h-4 w-4 text-red-600',
      textClassName: 'text-red-800 dark:text-red-200',
      message: isEmergencyMode
        ? 'Emergency mode active. Only critical operations available. Using cached data where possible.'
        : 'Service experiencing issues. Using cached data where possible.',
    },
  };

  const { icon: Icon, className, iconClassName, textClassName, message } = config[status] || config.unhealthy;

  return (
    <Alert className={`fixed top-16 left-4 right-4 z-40 ${className} md:left-auto md:right-4 md:w-96`}>
      <Icon className={iconClassName} />
      <AlertDescription className={textClassName}>
        {message}
      </AlertDescription>
    </Alert>
  );
};
