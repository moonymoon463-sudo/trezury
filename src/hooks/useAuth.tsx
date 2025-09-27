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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [newUserPassword, setNewUserPassword] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Create wallet for new users after authentication
        if (event === 'SIGNED_IN' && session?.user && newUserPassword) {
          setTimeout(async () => {
            try {
              await secureWalletService.generateDeterministicWallet(
                session.user.id,
                { userPassword: newUserPassword }
              );
              toast({
                title: "Wallet Created",
                description: "Your secure wallet has been created successfully",
              });
            } catch (error) {
              console.error('Failed to create wallet:', error);
              toast({
                variant: "destructive",
                title: "Wallet Creation Failed",
                description: "There was an issue creating your wallet. Please contact support.",
              });
            } finally {
              setNewUserPassword(null);
            }
          }, 1000);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [newUserPassword, toast]);

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
    
    // Store password temporarily for wallet creation
    setNewUserPassword(password);
    
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
      setNewUserPassword(null); // Clear password on error
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
        description: "Please check your email for a verification link. A secure wallet will be created upon first login.",
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