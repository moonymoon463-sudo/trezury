import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AurumLogo from "@/components/AurumLogo";
import { Shield, Smartphone, TrendingUp, Wallet, Zap, Lock } from "lucide-react";
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
            <AurumLogo />
            <span className="text-2xl font-bold text-aurum">Trezury</span>
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
            Secure Gold Trading
            <br />
            <span className="text-4xl md:text-6xl">in Your Pocket</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Trade, hold, and earn with digital gold. Your gateway to precious metals investing with the security of blockchain technology.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
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

      {/* CTA Section */}
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
            <AurumLogo />
            <span className="text-xl font-bold text-aurum">Trezury</span>
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
    </div>
  );
};

export default LandingPage;