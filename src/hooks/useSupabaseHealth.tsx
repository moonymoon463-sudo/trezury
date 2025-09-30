import { useState, useEffect } from 'react';
import { supabaseHealthMonitor } from '@/services/supabaseHealthMonitor';
import { trafficShedding } from '@/services/trafficShedding';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export const useSupabaseHealth = () => {
  const [status, setStatus] = useState<HealthStatus>('healthy');
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);

  useEffect(() => {
    // Subscribe to health status changes
    const unsubscribe = supabaseHealthMonitor.subscribe((newStatus) => {
      setStatus(newStatus);

      // Activate emergency mode if unhealthy
      if (newStatus === 'unhealthy') {
        trafficShedding.enableEmergencyMode();
        setIsEmergencyMode(true);
      } else if (newStatus === 'healthy' && isEmergencyMode) {
        trafficShedding.disableEmergencyMode();
        setIsEmergencyMode(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isEmergencyMode]);

  const forceCheck = () => {
    supabaseHealthMonitor.forceCheck();
  };

  return {
    status,
    isHealthy: status === 'healthy',
    isDegraded: status === 'degraded',
    isUnhealthy: status === 'unhealthy',
    isEmergencyMode,
    forceCheck,
  };
};
