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
    <div className="relative flex h-screen w-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center bg-card p-4 pb-2 justify-between sticky top-0 z-10 flex-shrink-0 border-b border-border">
        <div className="w-12"></div>
        <div className="flex-1 flex justify-center">
          <AurumLogo compact={true} />
        </div>
        <div className="flex w-12 items-center justify-end gap-2">
          <button 
            className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 w-10 bg-transparent text-foreground hover:bg-surface-elevated transition-colors"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
          </button>
          <button 
            className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 w-10 bg-transparent text-foreground hover:bg-surface-elevated transition-colors"
            onClick={() => navigate("/settings")}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-20 space-y-4">
          {/* Gold Price Section */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-foreground text-base font-bold">Gold Price</h3>
              {priceLoading ? (
                <div className="animate-pulse">
                  <div className="h-4 w-16 bg-muted rounded"></div>
                </div>
              ) : goldPrice && (
                <div className="flex items-center gap-1 text-primary">
                  <TrendingUp size={14} />
                  <span className="text-xs font-medium">
                    {goldPrice.change_percent_24h >= 0 ? "+" : ""}{goldPrice.change_percent_24h.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-foreground text-lg font-bold">
                  {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_oz.toFixed(2)}` : "N/A"}
                </p>
                <p className="text-muted-foreground text-xs">USD/oz</p>
              </div>
              <div className="text-right">
                <p className="text-foreground text-sm font-semibold">
                  {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_gram.toFixed(2)}` : "N/A"}
                </p>
                <p className="text-muted-foreground text-xs">USD/g</p>
              </div>
            </div>
          </div>

          {/* Action Buttons - Buy Options */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="bg-primary text-primary-foreground font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all hover:scale-105"
              onClick={() => navigate("/buy-sell-hub")}
            >
              <ShoppingCart size={16} />
              Buy Gold
            </Button>
            <Button 
              className="bg-card text-foreground font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-surface-elevated border border-border transition-all hover:scale-105"
              onClick={() => navigate("/buy-sell-hub")}
            >
              <DollarSign size={16} />
              Sell/Cash Out
            </Button>
            <Button 
              className="bg-card text-foreground font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-surface-elevated border border-border transition-all hover:scale-105"
              onClick={() => navigate("/swap")}
            >
              <ArrowRightLeft size={16} />
              Swap
            </Button>
            <Button 
              className="bg-card text-foreground font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-surface-elevated border border-border transition-all hover:scale-105"
              onClick={() => navigate("/trzry-reserves")}
            >
              <TrendingUp size={16} />
              Earn Interest
            </Button>
          </div>

          {/* Your Assets - Wallet Options */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <h3 className="text-foreground text-base font-bold mb-4">Your Assets</h3>
            <div className="space-y-3">
              {tokens.map((token, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-elevated transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-surface-elevated rounded-full flex items-center justify-center text-base border border-border">
                      {token.icon}
                    </div>
                    <div>
                      <p className="text-foreground font-medium text-sm">{token.name}</p>
                      <p className="text-muted-foreground text-xs">{token.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-foreground font-medium text-sm">{token.amount}</p>
                    <p className="text-muted-foreground text-xs">{token.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gold Price Chart */}
          <GoldPriceChart />
        </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Index;
