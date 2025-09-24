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
      <header className="p-4 border-b border-border bg-card">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-foreground hover:bg-surface-elevated"
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex-1 flex justify-center pr-6">
            <AurumLogo compact />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-24 pt-6">
        {/* Your Wallet Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4 text-center">Your Wallet</h2>
          <div className="bg-card p-6 rounded-xl border border-border hover:bg-surface-elevated transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-surface-elevated rounded-full flex items-center justify-center border border-border">
                <Wallet2 className="text-foreground" size={26} />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Active Wallet</p>
                <p className="text-foreground text-lg font-medium">App Custodial Wallet</p>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Balance</h2>
          <div className="space-y-4 max-w-md mx-auto">
            {/* USD Balance */}
            <div className="bg-card p-6 rounded-xl border border-border hover:bg-surface-elevated transition-all hover:scale-105">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-surface-elevated rounded-full flex items-center justify-center border border-border">
                  <DollarSign className="text-foreground" size={26} />
                </div>
                <div className="flex-1">
                  <p className="text-muted-foreground text-sm">USD</p>
                  <p className="text-foreground text-2xl font-bold">$1,234.56</p>
                </div>
              </div>
            </div>

            {/* Gold Balance */}
            <div className="bg-card p-6 rounded-xl border border-border hover:bg-surface-elevated transition-all hover:scale-105">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 bg-background rounded-sm flex items-center justify-center">
                    <div className="w-5 h-5 bg-primary transform rotate-45"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-muted-foreground text-sm">Gold</p>
                  <p className="text-foreground text-2xl font-bold">1.23456 oz</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manage Custodial Wallet */}
        <div className="mb-8 max-w-md mx-auto">
          <div className="bg-card p-6 rounded-xl border border-border hover:bg-surface-elevated transition-all hover:scale-105 cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-surface-elevated rounded-full flex items-center justify-center border border-border">
                <Shield className="text-foreground" size={26} />
              </div>
              <div className="flex-1">
                <p className="text-foreground text-lg font-medium">Manage Custodial Wallet</p>
                <p className="text-muted-foreground text-sm">View details and settings</p>
              </div>
              <ChevronRight className="text-muted-foreground" size={24} />
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