import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, TrendingUp, ShoppingCart, DollarSign, ArrowRightLeft, Plus, RefreshCw, Send, Download } from "lucide-react";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import GoldPriceChart from "@/components/GoldPriceChart";
import AppLayout from "@/components/AppLayout";
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
    <AppLayout 
      headerProps={{
        showRefreshButton: true,
        onRefresh: handleRefresh,
        isRefreshing: isRefreshing,
        showSettingsButton: true,
        rightActions: (
          <button 
            onClick={() => navigate("/settings")}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors touch-target"
          >
            <Settings size={20} />
          </button>
        )
      }}
    >
      <div className="mobile-spacing">
        {/* Gold Price Display */}
        <div className="bg-card rounded-xl mobile-touch-padding text-center mb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xl sm:text-2xl font-bold text-foreground">
              ${priceLoading ? "Loading..." : goldPrice ? goldPrice.usd_per_oz.toFixed(2) : "N/A"}
            </span>
            <span className="text-sm text-muted-foreground">/oz</span>
          </div>
          {goldPrice && (
            <div className={`flex items-center justify-center gap-1 ${goldPrice.change_percent_24h >= 0 ? "text-green-500" : "text-red-500"}`}>
              <TrendingUp className={goldPrice.change_percent_24h >= 0 ? "" : "rotate-180"} size={14} />
              <span className="text-sm font-medium">
                {goldPrice.change_percent_24h >= 0 ? "+" : ""}{goldPrice.change_percent_24h.toFixed(2)}%
              </span>
              <span className="text-xs text-muted-foreground">24h</span>
            </div>
          )}
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Button 
            onClick={() => navigate("/buy-sell-hub")}
            variant="outline"
            className="flex flex-col items-center gap-2 h-16 sm:h-20 text-xs sm:text-sm font-medium touch-target"
          >
            <ShoppingCart size={18} />
            <span>Buy/Sell</span>
          </Button>
          <Button 
            onClick={() => navigate("/swap")}
            variant="outline"
            className="flex flex-col items-center gap-2 h-16 sm:h-20 text-xs sm:text-sm font-medium touch-target"
          >
            <ArrowRightLeft size={18} />
            <span>Swap</span>
          </Button>
          <Button 
            onClick={() => navigate("/send")}
            variant="outline"
            className="flex flex-col items-center gap-2 h-16 sm:h-20 text-xs sm:text-sm font-medium touch-target"
          >
            <Send size={18} />
            <span>Send</span>
          </Button>
          <Button 
            onClick={() => navigate("/receive")}
            variant="outline"
            className="flex flex-col items-center gap-2 h-16 sm:h-20 text-xs sm:text-sm font-medium touch-target"
          >
            <Download size={18} />
            <span>Receive</span>
          </Button>
        </div>

        {/* Portfolio Summary */}
        <div className="bg-card rounded-xl mobile-touch-padding mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base sm:text-lg font-bold text-foreground">Portfolio</h2>
            <span className="text-base sm:text-lg font-bold text-foreground">
              ${totalPortfolioValue.toFixed(2)}
            </span>
          </div>
          <div className="mobile-spacing">
            {tokens.map((token, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{token.icon}</span>
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
        <div className="bg-card rounded-xl mobile-touch-padding">
          <GoldPriceChart />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;