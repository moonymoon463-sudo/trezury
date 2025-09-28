import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, ArrowRightLeft } from "lucide-react";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import AppLayout from "@/components/AppLayout";

const BuySellHub = () => {
  const navigate = useNavigate();
  const { price: goldPrice, loading: priceLoading } = useGoldPrice();

  return (
    <AppLayout 
      headerProps={{ 
        showBackButton: true, 
        backPath: "/" 
      }}
    >
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
                <p className="text-foreground font-medium">Choose your payment method</p>
                <p className="text-muted-foreground">Select from credit card, USDC, or auto-invest</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-xs">
                2
              </div>
              <div>
                <p className="text-foreground font-medium">Enter amount</p>
                <p className="text-muted-foreground">Specify how much gold you want to purchase</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-xs">
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
            className="bg-primary text-primary-foreground font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 w-full max-w-xs"
            onClick={() => navigate("/buy-gold")}
          >
            <TrendingUp size={16} />
            Quick Buy
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default BuySellHub;