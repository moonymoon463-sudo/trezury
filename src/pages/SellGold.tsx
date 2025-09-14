import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";

const SellGold = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-foreground hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Sell Gold</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4">
        <h2 className="text-2xl font-bold text-foreground mb-8">Which gold would you like to sell?</h2>
        
        <div className="space-y-4">
          {/* GOLD Token Option */}
          <button 
            onClick={() => navigate("/sell-gold/amount", { state: { asset: 'GOLD' } })}
            className="flex items-center gap-4 rounded-xl bg-card border border-border p-4 transition-colors hover:bg-accent w-full text-left"
          >
            <div className="flex-shrink-0">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">GOLD</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground">GOLD</p>
              <p className="text-sm text-muted-foreground">Aurum Gold Token</p>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </button>

          {/* PAXG Option - Disabled for now */}
          <button 
            onClick={() => navigate("/sell-gold/amount", { state: { asset: 'PAXG' } })}
            className="flex items-center gap-4 rounded-xl bg-card border border-border p-4 transition-colors hover:bg-accent w-full text-left opacity-50 cursor-not-allowed"
            disabled
          >
            <div className="flex-shrink-0">
              <div className="h-12 w-12 rounded-full bg-green-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm">PAXG</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground">PAXG</p>
              <p className="text-sm text-muted-foreground">Pax Gold (Coming Soon)</p>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default SellGold;