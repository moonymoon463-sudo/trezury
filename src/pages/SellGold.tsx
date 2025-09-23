import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import AurumLogo from "@/components/AurumLogo";
import { useMoonPaySell } from "@/hooks/useMoonPaySell";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { toast } from "sonner";

const SellGold = () => {
  const navigate = useNavigate();
  const { initiateSell, loading: sellLoading } = useMoonPaySell();
  const { getBalance } = useWalletBalance();
  
  const goldBalance = getBalance('GOLD');

  const handleSellGold = async () => {
    if (goldBalance <= 0) {
      toast.error("No GOLD balance available to sell");
      return;
    }

    try {
      // For simplicity, sell the entire balance
      // In a real scenario, you might want to convert to USD equivalent
      const result = await initiateSell({
        amount: goldBalance, // This will be converted by MoonPay
        currency: 'USDC',
        returnUrl: `${window.location.origin}/offramp/return`
      });

      if (result.success && result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch (error) {
      console.error('Error initiating sell:', error);
      toast.error("Failed to initiate sell transaction");
    }
  };

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
          <div className="flex-1 flex justify-center pr-6">
            <AurumLogo compact />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4">
        <h2 className="text-2xl font-bold text-foreground mb-8">Which gold would you like to sell?</h2>
        
        <div className="space-y-4">
          {/* GOLD Token Option */}
          <button 
            onClick={handleSellGold}
            disabled={sellLoading || goldBalance <= 0}
            className="flex items-center gap-4 rounded-xl bg-card border border-border p-4 transition-colors hover:bg-accent w-full text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex-shrink-0">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">GOLD</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground">GOLD</p>
              <p className="text-sm text-muted-foreground">
                {goldBalance > 0 ? `${goldBalance.toFixed(3)} tokens available` : 'No balance available'}
              </p>
            </div>
            {sellLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
            ) : (
              <ChevronRight size={20} className="text-muted-foreground" />
            )}
          </button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default SellGold;