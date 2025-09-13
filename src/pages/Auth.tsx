import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import AurumLogo from "@/components/AurumLogo";

const Auth = () => {
  const { user, signIn, signUp, loading } = useAuth();
  const [mode, setMode] = useState<'welcome' | 'signin' | 'signup'>('welcome');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);

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
      return; // Don't submit if checkboxes aren't checked
    }
    
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await signUp(email, password);
    if (!error) {
      setMode('welcome');
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col bg-background justify-center items-center">
        <AurumLogo />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (mode === 'signin') {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col bg-background justify-between px-6">
        <div className="flex flex-col items-center justify-center flex-grow pt-24 pb-12">
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
          
          <form onSubmit={handleSignIn} className="w-full max-w-sm space-y-4">
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
      </div>
    );
  }

  if (mode === 'signup') {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col bg-background justify-between">
        <div className="flex-grow">
          <header className="flex items-center justify-between p-4">
            <button 
              onClick={() => setMode('welcome')}
              className="text-white"
            >
              <svg fill="currentColor" height="24" viewBox="0 0 256 256" width="24" xmlns="http://www.w3.org/2000/svg">
                <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path>
              </svg>
            </button>
            <h1 className="text-xl font-bold text-white text-center flex-1">Sign Up</h1>
            <div className="w-6"></div>
          </header>
          
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
                    className="form-input w-full rounded-md border-0 bg-[#352C18] text-white placeholder:text-[#CCBA8E] focus:ring-2 focus:ring-inset focus:ring-[hsl(var(--aurum-gold))] h-14 p-4"
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
                    className="form-input w-full rounded-md border-0 bg-[#352C18] text-white placeholder:text-[#CCBA8E] focus:ring-2 focus:ring-inset focus:ring-[hsl(var(--aurum-gold))] h-14 p-4"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="h-5 w-5 rounded border-[#6a582f] border-2 bg-transparent text-[hsl(var(--aurum-gold))] data-[state=checked]:bg-[hsl(var(--aurum-gold))] data-[state=checked]:border-[hsl(var(--aurum-gold))] focus:ring-offset-0 focus:ring-2 focus:ring-[hsl(var(--aurum-gold))]"
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
                    className="h-5 w-5 rounded border-[#6a582f] border-2 bg-transparent text-[hsl(var(--aurum-gold))] data-[state=checked]:bg-[hsl(var(--aurum-gold))] data-[state=checked]:border-[hsl(var(--aurum-gold))] focus:ring-offset-0 focus:ring-2 focus:ring-[hsl(var(--aurum-gold))]"
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
                >
                  <svg className="text-white" fill="none" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Sign Up with Google
                </Button>
              </div>
            </form>
          </main>
        </div>
        
        {/* Bottom Navigation */}
        <nav className="flex items-center justify-around bg-background py-4 px-6 border-t border-[#352C18]">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 bg-[hsl(var(--aurum-gold))] rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
            </div>
            <span className="text-xs text-white mt-1">Dashboard</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#6a582f]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
              </svg>
            </div>
            <span className="text-xs text-[#6a582f] mt-1">Buy/Sell</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#6a582f]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/>
              </svg>
            </div>
            <span className="text-xs text-[#6a582f] mt-1">Swap</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#6a582f]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13,3A9,9 0 0,0 4,12H1L4.5,15.5L8,12H5A7,7 0 0,1 12,5A7,7 0 0,1 19,12A7,7 0 0,1 12,19C10.5,19 9.09,18.5 7.94,17.7L6.5,19.14C8.04,20.3 9.94,21 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3H13Z"/>
              </svg>
            </div>
            <span className="text-xs text-[#6a582f] mt-1">History</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#6a582f]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
              </svg>
            </div>
            <span className="text-xs text-[#6a582f] mt-1">Settings</span>
          </div>
        </nav>
      </div>
    );
  }

  // Welcome screen (default)
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background justify-between">
      <div className="flex flex-col items-center justify-center flex-grow pt-24 pb-12 px-6">
        <div className="flex items-center justify-center mb-8">
          <AurumLogo />
        </div>
        <h1 className="text-white text-3xl font-bold leading-tight tracking-tighter text-center mb-3">
          Welcome to Aurum
        </h1>
        <p className="text-muted-foreground text-base font-normal leading-normal text-center max-w-xs">
          Buy, sell, and hold tokenized gold and USD securely.
        </p>
      </div>
      
      <div className="w-full px-6 pb-8">
        <div className="mb-4">
          <Button 
            variant="aurum"
            className="w-full h-14 rounded-xl text-base"
            onClick={() => setMode('signin')}
          >
            Sign In
          </Button>
        </div>
        <div className="mb-4">
          <Button 
            variant="aurum-secondary"
            className="w-full h-14 rounded-xl text-base"
            onClick={() => setMode('signup')}
          >
            Create Account
          </Button>
        </div>
        <div className="flex justify-center">
          <Button 
            variant="ghost"
            className="h-12 px-4 bg-transparent text-white gap-2.5 text-sm font-semibold leading-normal hover:bg-white/10"
          >
            <svg className="text-white" fill="none" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign In with Google
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;