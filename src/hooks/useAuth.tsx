import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { secureWalletService } from "@/services/secureWalletService";
import { enhancedSecurityService } from "@/services/enhancedSecurityService";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error?: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error?: Error | null }>;
  signInWithGoogle: () => Promise<{ error?: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    // Initialize session once
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('[Auth] State change:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_OUT') {
          toast({
            title: "Signed out successfully",
            description: "You have been logged out of your account.",
          });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // Enhanced security validation
    const passwordValidation = await enhancedSecurityService.validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      toast({
        variant: "destructive",
        title: "Password Requirements Not Met",
        description: passwordValidation.errors.join('. '),
      });
      return { error: new Error(passwordValidation.errors.join('. ')) };
    }

    // Check if account is locked
    const isLocked = await enhancedSecurityService.checkAccountLocked(email);
    if (isLocked) {
      toast({
        variant: "destructive",
        title: "Account Temporarily Locked",
        description: "Too many failed attempts. Please try again later.",
      });
      return { error: new Error('Account temporarily locked') };
    }
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    // Log authentication attempt
    await enhancedSecurityService.recordAuthAttempt({
      email,
      success: !error,
      ip_address: await getClientIP(),
      user_agent: navigator.userAgent
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign Up Error",
        description: error.message,
      });

      // Log failed signup attempt as security event
      await enhancedSecurityService.logSecurityEvent({
        event_type: 'failed_signup',
        severity: 'medium',
        title: 'Failed Signup Attempt',
        description: `Failed signup attempt for email: ${email}`,
        metadata: {
          email,
          error_message: error.message,
          user_agent: navigator.userAgent
        }
      });
    } else {
      toast({
        title: "Check your email",
        description: "Please check your email for a verification link.",
      });

      // Log successful signup
      await enhancedSecurityService.logSecurityEvent({
        event_type: 'successful_signup',
        severity: 'low',
        title: 'New Account Created',
        description: `New account created for email: ${email}`,
        metadata: {
          email,
          user_agent: navigator.userAgent
        }
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    // Check if account is locked before attempting login
    const isLocked = await enhancedSecurityService.checkAccountLocked(email);
    if (isLocked) {
      toast({
        variant: "destructive",
        title: "Account Temporarily Locked",
        description: "Too many failed attempts. Please try again later or contact support.",
      });
      return { error: new Error('Account temporarily locked') };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Log authentication attempt
    await enhancedSecurityService.recordAuthAttempt({
      email,
      success: !error,
      ip_address: await getClientIP(),
      user_agent: navigator.userAgent
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign In Error",
        description: error.message,
      });

      // Log failed login as security event
      await enhancedSecurityService.logSecurityEvent({
        event_type: 'failed_login',
        severity: 'medium',
        title: 'Failed Login Attempt',
        description: `Failed login attempt for email: ${email}`,
        metadata: {
          email,
          error_message: error.message,
          user_agent: navigator.userAgent
        }
      });
    } else {
      // Log successful login
      await enhancedSecurityService.logSecurityEvent({
        event_type: 'successful_login',
        severity: 'low',
        title: 'Successful Login',
        description: `User logged in successfully: ${email}`,
        metadata: {
          email,
          user_agent: navigator.userAgent
        }
      });
    }

    return { error };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      });

      // Log OAuth attempt
      await enhancedSecurityService.logSecurityEvent({
        event_type: 'oauth_attempt',
        severity: 'medium',
        title: 'Google OAuth Sign-in Attempt',
        description: 'User attempting to sign in with Google',
        metadata: {
          provider: 'google',
          user_agent: navigator.userAgent
        }
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "OAuth Error",
          description: error.message,
        });

        // Log failed OAuth
        await enhancedSecurityService.logSecurityEvent({
          event_type: 'oauth_failed',
          severity: 'high',
          title: 'Google OAuth Failed',
          description: `OAuth sign-in failed: ${error.message}`,
          metadata: {
            provider: 'google',
            error_message: error.message,
            user_agent: navigator.userAgent
          }
        });
      }

      return { error };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        variant: "destructive",
        title: "Sign In Error",
        description: errorMessage,
      });
      return { error: error instanceof Error ? error : new Error(errorMessage) };
    }
  };

  const signOut = async () => {
    const currentUser = user;
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);

    // Log logout event
    if (currentUser) {
      await enhancedSecurityService.logSecurityEvent({
        event_type: 'logout',
        severity: 'low',
        title: 'User Logout',
        description: `User logged out: ${currentUser.email}`,
        user_id: currentUser.id,
        metadata: {
          email: currentUser.email,
          user_agent: navigator.userAgent
        }
      });
    }
  };

  // Helper function to get client IP
  const getClientIP = async (): Promise<string | null> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}