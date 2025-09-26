import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, ArrowRightLeft } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import StandardHeader from "@/components/StandardHeader";

const BuySellHub = () => {
  const navigate = useNavigate();
  const { price: goldPrice, loading: priceLoading } = useGoldPrice();

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col bg-background">
      <StandardHeader showBackButton backPath="/" />

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-3 md:px-4 pt-2 pb-[calc(var(--bottom-nav-height,56px)+env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto space-y-6">
          {/* Gold Price Section */}
          <div className="bg-card rounded-xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-foreground text-lg font-bold leading-tight tracking-[-0.015em]">
                Current Gold Price
              </h3>
              {priceLoading ? (
                <div className="animate-pulse">
                  <div className="h-4 w-16 bg-gray-600 rounded"></div>
                </div>
              ) : goldPrice && (
                <div className="flex items-center gap-1 text-primary">
                  <TrendingUp size={16} />
                  <span className="text-sm font-medium">
                    {goldPrice.change_percent_24h >= 0 ? "+" : ""}{goldPrice.change_percent_24h.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between gap-x-6 py-1">
                <p className="text-muted-foreground text-sm font-normal">USD/oz</p>
                <p className="text-foreground text-sm font-semibold text-right">
                  {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_oz.toFixed(2)}` : "N/A"}
                </p>
              </div>
              <div className="flex justify-between gap-x-6 py-1">
                <p className="text-muted-foreground text-sm font-normal">USD/g</p>
                <p className="text-foreground text-sm font-semibold text-right">
                  {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_gram.toFixed(2)}` : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="space-y-4">
            <div 
              onClick={() => navigate("/buy-gold")}
              className="bg-card rounded-xl p-6 cursor-pointer hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                  <TrendingUp size={24} className="text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="text-foreground text-lg font-bold mb-1">Buy Gold</h3>
                  <p className="text-muted-foreground text-sm">
                    Purchase physical gold backed tokens with Credit card or USDC
                  </p>
                </div>
                <ArrowRightLeft size={20} className="text-muted-foreground rotate-90" />
              </div>
            </div>

            <div 
              onClick={() => navigate("/sell-gold")}
              className="bg-card rounded-xl p-6 cursor-pointer hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-card border-2 border-primary rounded-full flex items-center justify-center">
                  <DollarSign size={24} className="text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-foreground text-lg font-bold mb-1">Sell Gold</h3>
                  <p className="text-muted-foreground text-sm">
                    Convert your gold tokens back to USDC or Fiat
                  </p>
                </div>
                <ArrowRightLeft size={20} className="text-muted-foreground rotate-90" />
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-card rounded-xl p-4">
            <h4 className="text-foreground font-semibold mb-3">How it works</h4>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-xs">
                  1
                </div>
                <div>
                  <p className="text-foreground font-medium">Choose your transaction</p>
                  <p className="text-muted-foreground">Select buy or sell based on your needs</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-xs">
                  2
                </div>
                <div>
                  <p className="text-foreground font-medium">Enter amount</p>
                  <p className="text-muted-foreground">Specify how much you want to buy or sell</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-xs">
                  3
                </div>
                <div>
                  <p className="text-foreground font-medium">Confirm transaction</p>
                  <p className="text-muted-foreground">Review details and complete your trade</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="bg-primary text-primary-foreground font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90"
              onClick={() => navigate("/buy-gold")}
            >
              <TrendingUp size={16} />
              Quick Buy
            </Button>
            <Button 
              className="bg-card border-2 border-primary text-primary font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => navigate("/sell-gold")}
            >
              <DollarSign size={16} />
              Quick Sell
            </Button>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default BuySellHub;