import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet2, DollarSign, ChevronRight, Shield } from "lucide-react";
import AurumLogo from "@/components/AurumLogo";

const Wallet = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="h-16 bg-background border-b border-border flex items-center px-4 flex-shrink-0">
        <div className="w-12 flex justify-start">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-foreground hover:bg-surface-elevated h-10 w-10"
          >
            <ArrowLeft size={20} />
          </Button>
        </div>
        
        <div className="flex-1 flex justify-center">
          <div className="h-12 flex items-center">
            <AurumLogo compact />
          </div>
        </div>
        
        <div className="w-12"></div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4">
        <div className="max-w-md mx-auto">
        {/* Your Wallet Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Your Wallet</h2>
          <div className="bg-card p-4 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-surface-elevated rounded-full flex items-center justify-center">
                <Wallet2 className="text-foreground" size={24} />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Active Wallet</p>
                <p className="text-foreground text-base font-medium">App Custodial Wallet</p>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-6">Balance</h2>
          <div className="space-y-3">
            {/* USD Balance */}
            <div className="bg-card p-4 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-surface-elevated rounded-full flex items-center justify-center">
                  <DollarSign className="text-foreground" size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-muted-foreground text-sm">USD</p>
                  <p className="text-foreground text-xl font-bold">$1,234.56</p>
                </div>
              </div>
            </div>

            {/* Gold Balance */}
            <div className="bg-card p-4 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                  <div className="w-6 h-6 bg-background rounded-sm flex items-center justify-center">
                    <div className="w-4 h-4 bg-primary transform rotate-45"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-muted-foreground text-sm">Gold</p>
                  <p className="text-foreground text-xl font-bold">1.23456 oz</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manage Custodial Wallet */}
        <div className="mb-8">
          <div className="bg-card p-4 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-surface-elevated rounded-full flex items-center justify-center">
                <Shield className="text-foreground" size={24} />
              </div>
              <div className="flex-1">
                <p className="text-foreground text-base font-medium">Manage Custodial Wallet</p>
              </div>
              <ChevronRight className="text-muted-foreground" size={20} />
            </div>
          </div>
        </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-card px-6 py-4">
        <div className="flex justify-around">
          <button 
            onClick={() => navigate("/")}
            className="flex flex-col items-center space-y-1"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-muted-foreground"></div>
            </div>
            <span className="text-xs text-muted-foreground">Home</span>
          </button>
          
          <button 
            onClick={() => navigate("/buy-gold")}
            className="flex flex-col items-center space-y-1"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-muted-foreground border-b-0"></div>
            </div>
            <span className="text-xs text-muted-foreground">Buy/Sell</span>
          </button>
          
          <button 
            onClick={() => navigate("/swap")}
            className="flex flex-col items-center space-y-1"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-muted-foreground transform rotate-45"></div>
              <div className="w-3 h-3 border-2 border-muted-foreground transform -rotate-45 -ml-2"></div>
            </div>
            <span className="text-xs text-muted-foreground">Swap</span>
          </button>
          
          <button className="flex flex-col items-center space-y-1">
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-muted-foreground rounded-full"></div>
            </div>
            <span className="text-xs text-muted-foreground">History</span>
          </button>
          
          <button className="flex flex-col items-center space-y-1">
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-4 h-4 bg-primary rounded"></div>
            </div>
            <span className="text-xs text-primary">Wallet</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Wallet;