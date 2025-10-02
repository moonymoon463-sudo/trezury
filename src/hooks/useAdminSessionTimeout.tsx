import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Admin Session Timeout Hook
 * 
 * Implements automatic session timeout for admin users after 15 minutes of inactivity.
 * Logs out the user and redirects to the auth page when timeout occurs.
 * 
 * @param isAdmin - Whether the current user is an admin
 * @param timeoutMinutes - Number of minutes before timeout (default: 15)
 */
export const useAdminSessionTimeout = (isAdmin: boolean, timeoutMinutes: number = 15) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef<boolean>(false);

  const TIMEOUT_MS = timeoutMinutes * 60 * 1000; // Convert to milliseconds
  const WARNING_MS = TIMEOUT_MS - (2 * 60 * 1000); // Warn 2 minutes before timeout

  const resetTimeout = () => {
    setLastActivity(Date.now());
    warningShownRef.current = false;
  };

  const handleLogout = async () => {
    toast({
      title: "Session Expired",
      description: "You have been logged out due to inactivity.",
      variant: "destructive",
    });

    // Log security event
    await supabase.from('security_alerts').insert({
      alert_type: 'admin_session_timeout',
      severity: 'low',
      title: 'Admin Session Timeout',
      description: 'Admin session expired due to inactivity',
      metadata: {
        timeout_minutes: timeoutMinutes,
        timestamp: new Date().toISOString()
      }
    });

    await supabase.auth.signOut();
    navigate('/auth');
  };

  useEffect(() => {
    // Only apply timeout for admin users
    if (!isAdmin) return;

    // Activity event listeners
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetTimeout();
    };

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Check for timeout every second
    const intervalId = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivity;

      // Show warning 2 minutes before timeout
      if (timeSinceLastActivity >= WARNING_MS && !warningShownRef.current) {
        warningShownRef.current = true;
        toast({
          title: "⏰ Session Expiring Soon",
          description: "Your session will expire in 2 minutes due to inactivity. Move your mouse to stay logged in.",
          variant: "destructive",
        });
      }

      // Logout if timeout exceeded
      if (timeSinceLastActivity >= TIMEOUT_MS) {
        handleLogout();
      }
    }, 1000);

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(intervalId);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isAdmin, lastActivity, timeoutMinutes]);

  return {
    lastActivity,
    resetTimeout,
    timeRemaining: Math.max(0, TIMEOUT_MS - (Date.now() - lastActivity))
  };
};
