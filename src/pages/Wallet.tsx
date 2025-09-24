import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet2, DollarSign, ChevronRight, Shield } from "lucide-react";
import AurumLogo from "@/components/AurumLogo";
import BottomNavigation from "@/components/BottomNavigation";

const Wallet = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="px-4 py-3 bg-background border-b border-border/5">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="h-10 w-10"
          >
            <ArrowLeft size={20} />
          </Button>
          <AurumLogo compact size="header" />
          <div className="w-10"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pt-4 pb-24">
        <div className="max-w-md mx-auto space-y-6">
          {/* Your Wallet Section */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4 text-center">Your Wallet</h2>
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
          <div>
            <h2 className="text-xl font-bold text-foreground mb-4 text-center">Balance</h2>
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
          <div>
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
      <BottomNavigation />
    </div>
  );
};

export default Wallet;