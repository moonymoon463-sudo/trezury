import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, TrendingUp, ShoppingCart, DollarSign, ArrowRightLeft, Plus, RefreshCw } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import GoldPriceChart from "@/components/GoldPriceChart";
import AurumLogo from "@/components/AurumLogo";
import { useState } from "react";

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { price: goldPrice, loading: priceLoading, refreshPrice } = useGoldPrice();
  const { getBalance, loading: balanceLoading } = useWalletBalance();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get real balances
  const usdcBalance = getBalance('USDC');
  const goldBalance = getBalance('GOLD');
  
  // Calculate portfolio values
  const goldValueUsd = goldPrice && goldBalance ? goldBalance * goldPrice.usd_per_gram : 0;
  const totalPortfolioValue = usdcBalance + goldValueUsd;

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshPrice();
    } finally {
      setIsRefreshing(false);
    }
  };

  const tokens = [
    {
      name: "Gold",
      symbol: "GOLD",
      amount: goldBalance.toFixed(3),
      value: `$${goldValueUsd.toFixed(2)}`,
      icon: "🥇"
    },
    {
      name: "USD Coin",
      symbol: "USDC", 
      amount: usdcBalance.toFixed(2),
      value: `$${usdcBalance.toFixed(2)}`,
      icon: "💲"
    }
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4 bg-background">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="w-10"></div>
          <AurumLogo compact />
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-10 w-10 text-foreground hover:bg-surface-elevated"
            >
              <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/settings")}
              className="h-10 w-10 text-foreground hover:bg-surface-elevated"
            >
              <Settings size={20} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="max-w-md mx-auto space-y-4">
          {/* Gold Price Section */}
          <div className="bg-card rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-foreground text-lg font-bold">Gold Price</h3>
              {priceLoading ? (
                <div className="animate-pulse">
                  <div className="h-4 w-16 bg-muted rounded"></div>
                </div>
              ) : goldPrice && (
                <div className="flex items-center gap-1 text-primary">
                  <TrendingUp size={14} />
                  <span className="text-sm font-medium">
                    {goldPrice.change_percent_24h >= 0 ? "+" : ""}{goldPrice.change_percent_24h.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-foreground text-xl font-bold">
                  {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_oz.toFixed(2)}` : "N/A"}
                </p>
                <p className="text-muted-foreground text-sm">USD/oz</p>
              </div>
              <div className="text-right">
                <p className="text-foreground text-lg font-semibold">
                  {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_gram.toFixed(2)}` : "N/A"}
                </p>
                <p className="text-muted-foreground text-sm">USD/g</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="bg-primary text-primary-foreground font-bold h-12 rounded-xl flex items-center justify-center gap-2"
              onClick={() => navigate("/buy-sell-hub")}
            >
              <ShoppingCart size={16} />
              Buy Gold
            </Button>
            <Button 
              variant="outline"
              className="font-bold h-12 rounded-xl flex items-center justify-center gap-2"
              onClick={() => navigate("/buy-sell-hub")}
            >
              <DollarSign size={16} />
              Sell/Cash Out
            </Button>
            <Button 
              variant="outline"
              className="font-bold h-12 rounded-xl flex items-center justify-center gap-2"
              onClick={() => navigate("/swap")}
            >
              <ArrowRightLeft size={16} />
              Swap
            </Button>
            <Button 
              variant="outline"
              className="font-bold h-12 rounded-xl flex items-center justify-center gap-2"
              onClick={() => navigate("/trzry-reserves")}
            >
              <TrendingUp size={16} />
              Earn Interest
            </Button>
          </div>

          {/* Your Assets */}
          <div className="bg-card rounded-xl p-4">
            <h3 className="text-foreground text-lg font-bold mb-4">Your Assets</h3>
            <div className="space-y-3">
              {tokens.map((token, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-surface-elevated rounded-full flex items-center justify-center">
                      {token.icon}
                    </div>
                    <div>
                      <p className="text-foreground font-medium">{token.name}</p>
                      <p className="text-muted-foreground text-sm">{token.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-foreground font-medium">{token.amount}</p>
                    <p className="text-muted-foreground text-sm">{token.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gold Price Chart */}
          <GoldPriceChart />
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Index;
