import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { quoteEngineService } from "@/services/quoteEngine";

const BuySellHub = () => {
  const navigate = useNavigate();
  const { price: goldPrice, loading: priceLoading, refreshPrice } = useGoldPrice();
  
  // Mock user balance - would come from wallet service
  const mockGoldBalance = 1.23456; // oz
  const goldBalanceValue = goldPrice ? mockGoldBalance * goldPrice.usd_per_oz : 0;

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
          <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Buy/Sell</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4">
        {/* Gold Price Section */}
        <div className="mb-8">
          <div className="bg-card p-6 rounded-xl border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <div className="w-6 h-6 bg-primary-foreground rounded-sm flex items-center justify-center">
                  <div className="w-4 h-4 bg-primary transform rotate-45"></div>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-foreground text-lg font-semibold">Gold Price</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={refreshPrice}
                    disabled={priceLoading}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw size={14} className={priceLoading ? "animate-spin" : ""} />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {priceLoading ? (
                    <div className="animate-pulse">
                      <div className="h-8 w-32 bg-muted rounded"></div>
                    </div>
                  ) : goldPrice ? (
                    <>
                      <span className="text-2xl font-bold text-foreground">
                        ${goldPrice.usd_per_oz.toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1">
                        {goldPrice.change_percent_24h >= 0 ? (
                          <TrendingUp size={16} className="text-green-500" />
                        ) : (
                          <TrendingDown size={16} className="text-red-500" />
                        )}
                        <span className={goldPrice.change_percent_24h >= 0 ? "text-green-500" : "text-red-500"}>
                          {goldPrice.change_percent_24h >= 0 ? "+" : ""}{goldPrice.change_percent_24h.toFixed(2)}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-xl text-muted-foreground">Price unavailable</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">Per troy ounce</p>
              {goldPrice && (
                <p className="text-muted-foreground text-xs">
                  Updated: {new Date(goldPrice.last_updated).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Your Gold Balance */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Your Gold</h2>
          <div className="bg-card p-6 rounded-xl border border-border">
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-2">Total Balance</p>
              <p className="text-3xl font-bold text-foreground mb-1">{mockGoldBalance.toFixed(5)} oz</p>
              <p className="text-xl text-muted-foreground">
                ≈ ${goldBalanceValue.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 mb-8">
          <Button
            onClick={() => navigate("/buy-gold")}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
            disabled={!goldPrice}
          >
            Buy Gold
          </Button>
          
          <Button
            onClick={() => navigate("/sell-gold")}
            variant="outline"
            className="w-full h-14 border-border text-foreground hover:bg-accent hover:text-accent-foreground font-semibold rounded-xl"
            disabled={!goldPrice}
          >
            Sell Gold
          </Button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default BuySellHub;