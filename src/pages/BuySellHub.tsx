import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TrendingUp, ArrowRightLeft } from "lucide-react";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import AppLayout from "@/components/AppLayout";

const BuySellHub = () => {
  const navigate = useNavigate();
  const { price: goldPrice, loading: priceLoading } = useGoldPrice();

  return (
    <AppLayout headerProps={{ showBackButton: true, backPath: "/" }} showBottomNavOnAllScreens={true}>
      <div className="max-w-md mx-auto space-y-4 h-[calc(100vh-8rem)] overflow-y-auto md:space-y-3">
        {/* Gold Price Section */}
        <div className="bg-card rounded-xl p-4 md:p-3">
          <div className="flex justify-between items-center mb-3 md:mb-2">
            <h3 className="text-foreground text-xl font-bold leading-tight tracking-[-0.015em] md:text-lg">
              Current Gold Price
            </h3>
            {priceLoading ? (
              <div className="animate-pulse">
                <div className="h-5 w-18 bg-gray-600 rounded md:h-4 md:w-16"></div>
              </div>
            ) : goldPrice && (
              <div className="flex items-center gap-1.5 text-primary md:gap-1">
                <TrendingUp size={20} className="md:w-4 md:h-4" />
                <span className="text-base font-medium md:text-sm">
                  {goldPrice.change_percent_24h >= 0 ? "+" : ""}{goldPrice.change_percent_24h.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          <div className="space-y-2 md:space-y-1">
            <div className="flex justify-between gap-x-6 py-2 md:py-1 min-h-[44px] md:min-h-[auto] items-center">
              <p className="text-muted-foreground text-base font-normal md:text-sm">USD/oz</p>
              <p className="text-foreground text-base font-semibold text-right md:text-sm">
                {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_oz.toFixed(2)}` : "N/A"}
              </p>
            </div>
            <div className="flex justify-between gap-x-6 py-2 md:py-1 min-h-[44px] md:min-h-[auto] items-center">
              <p className="text-muted-foreground text-base font-normal md:text-sm">USD/g</p>
              <p className="text-foreground text-base font-semibold text-right md:text-sm">
                {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_gram.toFixed(2)}` : "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div>
          <div 
            onClick={() => navigate("/buy-gold")}
            className="bg-card rounded-xl p-5 cursor-pointer hover:bg-accent transition-colors md:p-4 min-h-[80px] md:min-h-[auto]"
          >
            <div className="flex items-center gap-4 md:gap-3">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center md:w-10 md:h-10">
                <TrendingUp size={24} className="text-primary-foreground md:w-5 md:h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-foreground text-xl font-bold mb-1.5 md:text-lg md:mb-1">Buy Gold</h3>
                <p className="text-muted-foreground text-base md:text-sm">
                  Purchase physical gold backed tokens with Credit card or USDC
                </p>
              </div>
              <ArrowRightLeft size={24} className="text-muted-foreground rotate-90 md:w-5 md:h-5" />
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-card rounded-xl p-4 md:p-3">
          <h4 className="text-foreground font-semibold mb-3 text-lg md:text-base md:mb-2">How it works</h4>
          <div className="space-y-3 text-base md:space-y-2 md:text-sm">
            <div className="flex gap-3 md:gap-2 min-h-[48px] md:min-h-[auto] items-start">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm mt-1 md:w-5 md:h-5 md:text-xs md:mt-0.5">
                1
              </div>
              <div>
                <p className="text-foreground font-medium">Choose your payment method</p>
                <p className="text-muted-foreground">Select from credit card, USDC, or auto-invest</p>
              </div>
            </div>
            <div className="flex gap-3 md:gap-2 min-h-[48px] md:min-h-[auto] items-start">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm mt-1 md:w-5 md:h-5 md:text-xs md:mt-0.5">
                2
              </div>
              <div>
                <p className="text-foreground font-medium">Enter amount</p>
                <p className="text-muted-foreground">Specify how much gold you want to purchase</p>
              </div>
            </div>
            <div className="flex gap-3 md:gap-2 min-h-[48px] md:min-h-[auto] items-start">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm mt-1 md:w-5 md:h-5 md:text-xs md:mt-0.5">
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
            className="bg-primary text-primary-foreground font-bold h-14 md:h-12 rounded-xl flex items-center justify-center gap-2.5 md:gap-2 hover:bg-primary/90 w-full max-w-xs text-lg md:text-base"
            onClick={() => navigate("/buy-gold")}
          >
            <TrendingUp size={20} className="md:w-4 md:h-4" />
            Quick Buy
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default BuySellHub;