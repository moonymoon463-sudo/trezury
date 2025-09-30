import { useEffect, useCallback } from 'react';
import { useSupabaseConnection } from '@/hooks/useSupabaseConnection';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const SessionHealthMonitor = () => {
  const { status, refreshSession } = useSupabaseConnection();

  const handleProactiveRefresh = useCallback(async () => {
    if (!status.sessionValid) return;
    
    // Refresh token 5 minutes before expiry
    if (status.minutesUntilExpiry !== null && status.minutesUntilExpiry <= 5 && status.minutesUntilExpiry > 0) {
      console.log('[Session Monitor] Proactively refreshing token (expires in', status.minutesUntilExpiry, 'minutes)');
      
      const success = await refreshSession();
      
      if (!success) {
        toast.error('Session refresh failed', {
          description: 'Please log in again to continue',
        });
        
        // Log security event
        try {
          await supabase.rpc('log_security_event', {
            event_type: 'SESSION_REFRESH_FAILED',
            event_data: {
              minutes_until_expiry: status.minutesUntilExpiry,
              timestamp: new Date().toISOString(),
            },
          });
        } catch (err) {
          console.error('[Session Monitor] Failed to log security event:', err);
        }
      }
    }
  }, [status, refreshSession]);

  const handleConnectionRecovery = useCallback(async () => {
    if (!status.isHealthy && status.sessionValid === false && status.error) {
      console.log('[Session Monitor] Connection unhealthy, attempting recovery...');
      
      let attempts = 0;
      const maxAttempts = 3;
      const delays = [1000, 2000, 4000]; // Exponential backoff
      
      while (attempts < maxAttempts) {
        console.log(`[Session Monitor] Recovery attempt ${attempts + 1}/${maxAttempts}`);
        
        const success = await refreshSession();
        
        if (success) {
          console.log('[Session Monitor] Recovery successful');
          toast.success('Connection restored');
          
          // Log successful recovery
          try {
            await supabase.rpc('log_security_event', {
              event_type: 'SESSION_RECOVERY_SUCCESS',
              event_data: {
                attempts: attempts + 1,
                timestamp: new Date().toISOString(),
              },
            });
          } catch (err) {
            console.error('[Session Monitor] Failed to log recovery:', err);
          }
          
          return;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delays[attempts - 1]));
        }
      }
      
      // All recovery attempts failed
      console.error('[Session Monitor] All recovery attempts failed');
      toast.error('Unable to restore connection', {
        description: 'Please refresh the page or log in again',
        duration: 10000,
      });
      
      // Log failed recovery
      try {
        await supabase.rpc('log_security_event', {
          event_type: 'SESSION_RECOVERY_FAILED',
          event_data: {
            attempts: maxAttempts,
            error: status.error,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.error('[Session Monitor] Failed to log recovery failure:', err);
      }
    }
  }, [status, refreshSession]);

  // Monitor for proactive refresh needs
  useEffect(() => {
    if (status.sessionValid && status.minutesUntilExpiry !== null) {
      handleProactiveRefresh();
    }
  }, [status.minutesUntilExpiry, handleProactiveRefresh]);

  // Monitor for connection issues and attempt recovery
  useEffect(() => {
    if (!status.isHealthy && status.error) {
      handleConnectionRecovery();
    }
  }, [status.isHealthy, status.error, handleConnectionRecovery]);

  // This component doesn't render anything
  return null;
};
