import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

interface ConnectionStatus {
  isConnected: boolean;
  isHealthy: boolean;
  sessionValid: boolean;
  tokenExpiresAt: Date | null;
  minutesUntilExpiry: number | null;
  lastChecked: Date;
  error: string | null;
}

export const useSupabaseConnection = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: true,
    isHealthy: true,
    sessionValid: false,
    tokenExpiresAt: null,
    minutesUntilExpiry: null,
    lastChecked: new Date(),
    error: null,
  });

  const checkConnectionHealth = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[Connection Monitor] Session check failed:', error);
        setStatus(prev => ({
          ...prev,
          isConnected: false,
          isHealthy: false,
          sessionValid: false,
          error: error.message,
          lastChecked: new Date(),
        }));
        return false;
      }

      if (!session) {
        setStatus(prev => ({
          ...prev,
          isConnected: true,
          isHealthy: true,
          sessionValid: false,
          tokenExpiresAt: null,
          minutesUntilExpiry: null,
          error: null,
          lastChecked: new Date(),
        }));
        return false;
      }

      const expiresAt = new Date(session.expires_at! * 1000);
      const minutesUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / 60000);

      setStatus({
        isConnected: true,
        isHealthy: minutesUntilExpiry > 0,
        sessionValid: minutesUntilExpiry > 0,
        tokenExpiresAt: expiresAt,
        minutesUntilExpiry,
        lastChecked: new Date(),
        error: null,
      });

      return minutesUntilExpiry > 0;
    } catch (err) {
      console.error('[Connection Monitor] Unexpected error:', err);
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        isHealthy: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        lastChecked: new Date(),
      }));
      return false;
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[Connection Monitor] Attempting to refresh session...');
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[Connection Monitor] Session refresh failed:', error);
        return false;
      }

      if (session) {
        console.log('[Connection Monitor] Session refreshed successfully');
        await checkConnectionHealth();
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('[Connection Monitor] Session refresh error:', err);
      return false;
    }
  }, [checkConnectionHealth]);

  useEffect(() => {
    // Initial check
    checkConnectionHealth();

    // Check every 30 seconds
    const healthCheckInterval = setInterval(checkConnectionHealth, 30000);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Connection Monitor] Auth state changed:', event);
      
      if (event === 'SIGNED_OUT') {
        setStatus({
          isConnected: true,
          isHealthy: true,
          sessionValid: false,
          tokenExpiresAt: null,
          minutesUntilExpiry: null,
          lastChecked: new Date(),
          error: null,
        });
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        checkConnectionHealth();
      }
    });

    return () => {
      clearInterval(healthCheckInterval);
      subscription.unsubscribe();
    };
  }, [checkConnectionHealth]);

  return {
    status,
    checkConnectionHealth,
    refreshSession,
  };
};
