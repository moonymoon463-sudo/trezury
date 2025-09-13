import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AurumLogo from "@/components/AurumLogo";

const Auth = () => {
  const { user, signIn, signUp, loading } = useAuth();
  const [mode, setMode] = useState<'welcome' | 'signin' | 'signup'>('welcome');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            Create Account
          </h1>
          <p className="text-muted-foreground text-base font-normal leading-normal text-center max-w-xs mb-8">
            Join Aurum today
          </p>
          
          <form onSubmit={handleSignUp} className="w-full max-w-sm space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-white">Email</Label>
              <Input
                id="signup-email"
                name="email"
                type="email"
                placeholder="your@email.com"
                className="bg-[hsl(var(--aurum-gray))] border-0 text-white placeholder:text-muted-foreground"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password" className="text-white">Password</Label>
              <Input
                id="signup-password"
                name="password"
                type="password"
                placeholder="Create a password"
                className="bg-[hsl(var(--aurum-gray))] border-0 text-white placeholder:text-muted-foreground"
                required
                minLength={6}
              />
            </div>
            <Button 
              type="submit" 
              variant="aurum"
              className="w-full h-14 rounded-xl text-base"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </div>
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