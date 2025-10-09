import { useState, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import AurumLogo from "@/components/AurumLogo";
import AppLayout from "@/components/AppLayout";

const Auth = () => {
  const { user, signIn, signUp, signInWithGoogle, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'welcome' | 'signin' | 'signup'>('welcome');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralCodeValid, setReferralCodeValid] = useState<boolean | null>(null);

  // Check for referral code in URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
      validateReferralCode(refCode);
    }
  }, [searchParams]);

  const validateReferralCode = async (code: string) => {
    if (!code) {
      setReferralCodeValid(null);
      return;
    }

    const { data } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('code', code.toUpperCase())
      .single();

    setReferralCodeValid(!!data);
  };

  // Redirect if already authenticated
  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await signIn(email, password);
    if (!error) {
      setMode('welcome');
    }
    setIsSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!termsAccepted || !riskAccepted) {
      return;
    }
    
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const refCode = formData.get("referral_code") as string;

    const { error } = await signUp(email, password);
    
    // Apply referral code if provided and valid
    if (!error && refCode && referralCodeValid) {
      // Get current user after signup
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase.rpc('apply_referral_code' as any, {
          p_referee_id: userData.user.id,
          p_referral_code: refCode.toUpperCase()
        });
      }
    }
    
    if (!error) {
      setMode('welcome');
    }
    setIsSubmitting(false);
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    const { error } = await signInWithGoogle();
    if (error) {
      console.error('Google sign-in error:', error);
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <AppLayout showHeader={false} showBottomNav={false}>
        <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-2rem)]">
          <AurumLogo />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  if (mode === 'signin') {
    return (
      <AppLayout showHeader={false} showBottomNav={false}>
        <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-2rem)] px-6">
          <button 
            onClick={() => setMode('welcome')}
            className="self-start mb-8 text-muted-foreground"
          >
            ← Back
          </button>
          <div className="flex items-center justify-center mb-8">
            <AurumLogo />
          </div>
          <h1 className="text-white text-3xl font-bold leading-tight tracking-tighter text-center mb-3">
            Sign In
          </h1>
          <p className="text-muted-foreground text-base font-normal leading-normal text-center max-w-xs mb-8">
            Welcome back to Aurum
          </p>
          
          <form onSubmit={handleSignIn} className="w-full max-w-md space-y-4 md:max-w-lg">
            <div className="space-y-2">
              <Label htmlFor="signin-email" className="text-white">Email</Label>
              <Input
                id="signin-email"
                name="email"
                type="email"
                placeholder="your@email.com"
                className="bg-[hsl(var(--aurum-gray))] border-0 text-white placeholder:text-muted-foreground"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password" className="text-white">Password</Label>
              <Input
                id="signin-password"
                name="password"
                type="password"
                placeholder="Your password"
                className="bg-[hsl(var(--aurum-gray))] border-0 text-white placeholder:text-muted-foreground"
                required
              />
            </div>
            <Button 
              type="submit" 
              variant="aurum"
              className="w-full h-14 rounded-xl text-base"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>
      </AppLayout>
    );
  }

  if (mode === 'signup') {
    return (
      <AppLayout 
        showHeader={true} 
        showBottomNav={true}
        headerProps={{
          title: "Sign Up",
          showBackButton: true,
          onBack: () => setMode('welcome')
        }}
      >
        <main className="p-4 space-y-6">
          <form onSubmit={handleSignUp} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="signup-email" className="sr-only">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  placeholder="Email"
                  className="form-input w-full rounded-md border-0 bg-[hsl(var(--aurum-dark))] text-white placeholder:text-[hsl(var(--aurum-muted))] focus:ring-2 focus:ring-inset focus:ring-[hsl(var(--aurum-gold))] h-14 p-4"
                  required
                />
              </div>
              <div>
                <Label htmlFor="signup-password" className="sr-only">Password</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  placeholder="Password"
                  className="form-input w-full rounded-md border-0 bg-[hsl(var(--aurum-dark))] text-white placeholder:text-[hsl(var(--aurum-muted))] focus:ring-2 focus:ring-inset focus:ring-[hsl(var(--aurum-gold))] h-14 p-4"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <Label htmlFor="referral-code" className="sr-only">Referral Code (Optional)</Label>
                <div className="relative">
                  <Input
                    id="referral-code"
                    name="referral_code"
                    type="text"
                    placeholder="Referral Code (Optional)"
                    value={referralCode}
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase();
                      setReferralCode(code);
                      if (code.length >= 6) {
                        validateReferralCode(code);
                      } else {
                        setReferralCodeValid(null);
                      }
                    }}
                    className={`form-input w-full rounded-md border-0 bg-[hsl(var(--aurum-dark))] text-white placeholder:text-[hsl(var(--aurum-muted))] focus:ring-2 focus:ring-inset h-14 p-4 pr-10 ${
                      referralCodeValid === true 
                        ? 'focus:ring-green-500' 
                        : referralCodeValid === false 
                        ? 'focus:ring-red-500' 
                        : 'focus:ring-[hsl(var(--aurum-gold))]'
                    }`}
                    maxLength={12}
                  />
                  {referralCodeValid === true && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-sm">
                      +2 pts
                    </span>
                  )}
                </div>
                {referralCodeValid === true && (
                  <p className="text-xs text-green-500 mt-1">
                    Valid! You and your referrer will each get 2 bonus points
                  </p>
                )}
                {referralCodeValid === false && (
                  <p className="text-xs text-red-500 mt-1">
                    Invalid referral code
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  className="h-5 w-5 rounded border-[hsl(var(--aurum-border))] border-2 bg-transparent text-[hsl(var(--aurum-gold))] data-[state=checked]:bg-[hsl(var(--aurum-gold))] data-[state=checked]:border-[hsl(var(--aurum-gold))] focus:ring-offset-0 focus:ring-2 focus:ring-[hsl(var(--aurum-gold))]"
                />
                <label htmlFor="terms" className="ml-3 text-white text-sm">
                  I agree to the{" "}
                  <span className="underline text-[hsl(var(--aurum-gold))] cursor-pointer">
                    Terms & Conditions
                  </span>
                </label>
              </div>
              <div className="flex items-center">
                <Checkbox
                  id="risk"
                  checked={riskAccepted}
                  onCheckedChange={(checked) => setRiskAccepted(checked === true)}
                  className="h-5 w-5 rounded border-[hsl(var(--aurum-border))] border-2 bg-transparent text-[hsl(var(--aurum-gold))] data-[state=checked]:bg-[hsl(var(--aurum-gold))] data-[state=checked]:border-[hsl(var(--aurum-gold))] focus:ring-offset-0 focus:ring-2 focus:ring-[hsl(var(--aurum-gold))]"
                />
                <label htmlFor="risk" className="ml-3 text-white text-sm">
                  I agree to the{" "}
                  <span className="underline text-[hsl(var(--aurum-gold))] cursor-pointer">
                    Risk Disclosure
                  </span>
                </label>
              </div>
            </div>
            
            <div className="space-y-4">
              <Button 
                type="submit" 
                variant="aurum"
                className="w-full h-14 rounded-xl text-base"
                disabled={isSubmitting || !termsAccepted || !riskAccepted}
              >
                {isSubmitting ? "Creating account..." : "Sign Up"}
              </Button>
              
              <Button 
                type="button"
                variant="aurum-secondary"
                className="w-full h-14 rounded-xl text-base flex items-center justify-center gap-3"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
              >
                <svg className="text-white" fill="none" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {isSubmitting ? "Signing up..." : "Sign Up with Google"}
              </Button>
            </div>
          </form>
        </main>
      </AppLayout>
    );
  }

  // Welcome screen (default)
  return (
    <AppLayout showHeader={false} showBottomNav={false}>
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-2rem)] px-6">
        <div className="flex-grow flex flex-col items-center justify-center">
          <div className="flex items-center justify-center mb-8">
            <AurumLogo />
          </div>
          <p className="text-muted-foreground text-base font-normal leading-normal text-center max-w-xs mb-6">
            Buy, sell, and hold tokenized gold and USD securely.
          </p>
        </div>
        
        <div className="w-full max-w-md space-y-4 md:max-w-lg">
          <Button 
            variant="aurum"
            className="w-full h-14 rounded-xl text-base"
            onClick={() => setMode('signin')}
          >
            Sign In
          </Button>
          <Button 
            variant="aurum-secondary"
            className="w-full h-14 rounded-xl text-base"
            onClick={() => setMode('signup')}
          >
            Create Account
          </Button>
          <div className="flex justify-center">
            <Button 
              variant="ghost"
              className="h-12 px-4 bg-transparent text-white gap-2.5 text-sm font-semibold leading-normal hover:bg-white/10"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
            >
              <svg className="text-white" fill="none" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {isSubmitting ? "Signing in..." : "Sign In with Google"}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Auth;