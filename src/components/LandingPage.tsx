import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import trezuryLogo from "@/assets/trezury_logo.svg";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Shield, Smartphone, TrendingUp, Wallet, Zap, Lock, Download, Apple } from "lucide-react";
import { Link } from "react-router-dom";

const LandingPage = () => {
  const features = [
    {
      icon: TrendingUp,
      title: "Gold Trading",
      description: "Buy and sell gold with real-time pricing and instant settlements"
    },
    {
      icon: Wallet,
      title: "Secure Wallet",
      description: "Your assets are protected with enterprise-grade security"
    },
    {
      icon: Zap,
      title: "Instant Swaps",
      description: "Seamlessly swap between USDC and gold tokens"
    },
    {
      icon: Shield,
      title: "Lending Platform",
      description: "Earn yield on your gold holdings through our lending protocol"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-surface-elevated">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src={trezuryLogo} alt="Trezury logo" className="h-8 w-auto" />
          </div>
          <Link to="/auth">
            <Button variant="outline" className="border-aurum-glow text-aurum hover:bg-aurum-glow/10">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-aurum via-aurum-glow to-aurum bg-clip-text text-transparent">
            Digital Gold Trading
            <br />
            <span className="text-4xl md:text-6xl">Made Simple</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Trade and earn with digital gold on a secure blockchain platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-to-r from-aurum to-aurum-glow hover:from-aurum-glow hover:to-aurum text-background font-semibold px-8 py-6 text-lg">
                <Smartphone className="mr-2 h-5 w-5" />
                Start Trading Gold
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="border-aurum-glow text-aurum hover:bg-aurum-glow/10 px-8 py-6 text-lg">
              <Shield className="mr-2 h-5 w-5" />
              Learn More
            </Button>
          </div>
          
          {/* Download App Section */}
          <div className="bg-surface-elevated/50 rounded-2xl p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-semibold mb-4 text-foreground">Download Our Mobile App</h3>
            <p className="text-muted-foreground mb-6">Trade gold on the go with our secure mobile application</p>
            <div className="flex flex-col gap-6 items-center max-w-md mx-auto">
              {/* PWA Install Button */}
              <div className="w-full space-y-3">
                <Button 
                  size="lg" 
                  className="w-full bg-gradient-to-r from-aurum to-aurum-glow hover:from-aurum-glow hover:to-aurum text-background font-semibold px-6 py-3"
                  onClick={() => {
                    if ('serviceWorker' in navigator) {
                      const event = new CustomEvent('showInstallPrompt');
                      window.dispatchEvent(event);
                    }
                  }}
                >
                  <Smartphone className="w-5 h-5 mr-2" />
                  Install Mobile App
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Install to your phone for quick access
                </p>
              </div>

              {/* Native App Store Badges */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                {/* App Store Badge */}
                <button 
                  disabled
                  className="flex items-center justify-center rounded-lg px-4 py-2 opacity-60 cursor-not-allowed shadow-sm min-h-[60px] flex-1"
                  style={{
                    background: 'linear-gradient(135deg, #000 0%, #333 100%)',
                    border: '1px solid #444'
                  }}
                >
                  <svg className="w-7 h-7 mr-3 text-white" viewBox="0 0 24 24" fill="white">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs text-white/80 font-normal leading-tight">Download on the</div>
                    <div className="text-sm font-bold text-white leading-tight">App Store</div>
                    <div className="text-xs text-aurum font-semibold mt-0.5">Coming Soon</div>
                  </div>
                </button>
                
                {/* Google Play Badge */}
                <button 
                  disabled
                  className="flex items-center justify-center rounded-lg px-4 py-2 opacity-60 cursor-not-allowed shadow-sm min-h-[60px] flex-1 bg-surface-elevated border border-border"
                >
                  <svg className="w-7 h-7 mr-3 text-white" viewBox="0 0 24 24" fill="white">
                    <path d="M3.609 1.814L13.792 12L3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.5 12.707l2.198-2.198zM5.864 2.658L16.802 8.99 14.5 11.293 5.864 2.658z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs text-white/80 font-normal leading-tight">Get it on</div>
                    <div className="text-sm font-bold text-white leading-tight">Google Play</div>
                    <div className="text-xs text-aurum font-semibold mt-0.5">Coming Soon</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-surface-elevated/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Everything You Need to Trade Gold
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional-grade tools and security for modern precious metals investing
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-background/60 border-border/40 hover:border-aurum-glow/40 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-aurum/20 to-aurum-glow/20 flex items-center justify-center">
                    <feature.icon className="h-8 w-8 text-aurum" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-16 text-foreground">
            Start Trading in 3 Simple Steps
          </h2>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-aurum to-aurum-glow rounded-full flex items-center justify-center text-background font-bold text-2xl">
                1
              </div>
              <h3 className="text-2xl font-semibold text-foreground">Sign Up</h3>
              <p className="text-muted-foreground">Create your secure account with KYC verification</p>
            </div>
            
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-aurum to-aurum-glow rounded-full flex items-center justify-center text-background font-bold text-2xl">
                2
              </div>
              <h3 className="text-2xl font-semibold text-foreground">Fund Wallet</h3>
              <p className="text-muted-foreground">Add funds via bank transfer or cryptocurrency</p>
            </div>
            
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-aurum to-aurum-glow rounded-full flex items-center justify-center text-background font-bold text-2xl">
                3
              </div>
              <h3 className="text-2xl font-semibold text-foreground">Trade Gold</h3>
              <p className="text-muted-foreground">Buy, sell, and earn with digital gold tokens</p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 px-4 bg-surface-elevated/30">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="mb-12">
            <Lock className="w-16 h-16 mx-auto mb-6 text-aurum" />
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Bank-Grade Security
            </h2>
            <p className="text-xl text-muted-foreground">
              Your assets are protected with the highest security standards
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Encrypted Wallets</h3>
              <p className="text-muted-foreground">Multi-signature security with hardware-grade encryption</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">KYC Verified</h3>
              <p className="text-muted-foreground">Compliant with international regulatory standards</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Insured Assets</h3>
              <p className="text-muted-foreground">Your digital gold is backed by physical reserves</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            Ready to Start Trading?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of users who trust Trezury for their gold investments
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-to-r from-aurum to-aurum-glow hover:from-aurum-glow hover:to-aurum text-background font-semibold px-12 py-6 text-xl">
              Get Started Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/80 py-12 px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <img src={trezuryLogo} alt="Trezury logo" className="h-8 w-auto" />
          </div>
          <p className="text-muted-foreground mb-4">
            Secure Gold Trading Platform
          </p>
          <div className="flex justify-center space-x-8 text-sm text-muted-foreground">
            <Link to="/privacy-policy" className="hover:text-aurum transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-service" className="hover:text-aurum transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
      
      {/* Install Prompt */}
      <InstallPrompt />
    </div>
  );
};

export default LandingPage;