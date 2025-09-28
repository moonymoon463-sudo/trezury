import { useNavigate } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import AppLayout from "@/components/AppLayout";

const BuySellHub = () => {
  const navigate = useNavigate();
  const { price: goldPrice, loading: priceLoading } = useGoldPrice();

  return (
    <AppLayout headerProps={{ showBackButton: true, backPath: "/" }}>
      <div className="w-full max-w-md mx-auto mobile-spacing">
        {/* Gold Price Section */}
        <div className="bg-card rounded-xl mobile-touch-padding">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-foreground text-base sm:text-lg font-bold leading-tight tracking-[-0.015em]">
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
        <div className="space-y-3 sm:space-y-4">
          <div 
            onClick={() => navigate("/buy-gold")}
            className="bg-card rounded-xl mobile-touch-padding cursor-pointer hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <TrendingUp size={20} className="text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-foreground text-base sm:text-lg font-bold mb-1">Buy Gold</h3>
                <p className="text-muted-foreground text-sm">
                  Purchase physical gold backed tokens with Credit card or USDC
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-card rounded-xl mobile-touch-padding">
          <h4 className="text-foreground font-semibold mb-3 text-sm sm:text-base">How it works</h4>
          <div className="mobile-spacing text-sm">
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0">
                1
              </div>
              <div>
                <p className="text-foreground font-medium">Choose your payment method</p>
                <p className="text-muted-foreground">Select from credit card, USDC, or auto-invest</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0">
                2
              </div>
              <div>
                <p className="text-foreground font-medium">Enter amount</p>
                <p className="text-muted-foreground">Specify how much gold you want to purchase</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0">
                3
              </div>
              <div>
                <p className="text-foreground font-medium">Confirm purchase</p>
                <p className="text-muted-foreground">Review details and complete your gold purchase</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex justify-center">
          <Button 
            className="bg-primary text-primary-foreground font-bold h-12 sm:h-14 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 w-full max-w-xs touch-target"
            onClick={() => navigate("/buy-gold")}
          >
            <TrendingUp size={16} />
            <span className="text-sm sm:text-base">Quick Buy</span>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default BuySellHub;