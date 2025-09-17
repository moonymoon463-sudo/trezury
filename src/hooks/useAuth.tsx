import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { secureWalletService } from "@/services/secureWalletService";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error?: any }>;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
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
    
    // Store password temporarily for wallet creation
    setNewUserPassword(password);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      setNewUserPassword(null); // Clear password on error
      toast({
        variant: "destructive",
        title: "Sign Up Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Check your email",
        description: "Please check your email for a verification link. A secure wallet will be created upon first login.",
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign In Error",
        description: error.message,
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
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