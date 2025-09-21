import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, TrendingUp, ShoppingCart, DollarSign, ArrowRightLeft, Plus, RefreshCw } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { usePortfolioMonitoring } from "@/hooks/usePortfolioMonitoring";
import GoldPriceChart from "@/components/GoldPriceChart";
import AurumLogo from "@/components/AurumLogo";
import { PositionsCard } from "@/components/portfolio/PositionsCard";
import { PortfolioSummaryCard } from "@/components/portfolio/PortfolioSummaryCard";
import { useState } from "react";

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { price: goldPrice, loading: priceLoading, refreshPrice } = useGoldPrice();
  const { getBalance, loading: balanceLoading } = useWalletBalance();
  const { 
    portfolioSummary, 
    portfolioPerformance, 
    portfolioAssets, 
    assetsByType, 
    loading: portfolioLoading 
  } = usePortfolioMonitoring();
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
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-[#1A1A1A] justify-between">
      <div className="flex-grow">
        {/* Header */}
        <div className="flex items-center bg-[#1A1A1A] p-4 pb-2 justify-between sticky top-0 z-10">
          <div className="w-12"></div>
          <div className="flex-1 flex justify-center">
            <AurumLogo compact={true} />
          </div>
          <div className="flex w-12 items-center justify-end gap-2">
            <button 
              className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 w-10 bg-transparent text-white hover:bg-white/10 transition-colors"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
            </button>
            <button 
              className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 w-10 bg-transparent text-white hover:bg-white/10 transition-colors"
              onClick={() => navigate("/settings")}
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-4 pb-4 space-y-3">
          {/* Action Buttons - Moved to Top */}
          <div className="grid grid-cols-2 gap-2">
            <Button 
              className="bg-[#f9b006] text-black font-bold h-10 rounded-xl flex items-center justify-center gap-2 hover:bg-[#f9b006]/90 text-sm"
              onClick={() => navigate("/buy-sell-hub")}
            >
              <ShoppingCart size={14} />
              Buy Gold
            </Button>
            <Button 
              className="bg-[#2C2C2E] text-white font-bold h-10 rounded-xl flex items-center justify-center gap-2 hover:bg-[#2C2C2E]/80 text-sm"
              onClick={() => navigate("/buy-sell-hub")}
            >
              <DollarSign size={14} />
              Sell/Cash Out
            </Button>
            <Button 
              className="bg-[#2C2C2E] text-white font-bold h-10 rounded-xl flex items-center justify-center gap-2 hover:bg-[#2C2C2E]/80 text-sm"
              onClick={() => navigate("/swap")}
            >
              <ArrowRightLeft size={14} />
              Swap
            </Button>
            <Button 
              className="bg-[#2C2C2E] text-white font-bold h-10 rounded-xl flex items-center justify-center gap-2 hover:bg-[#2C2C2E]/80 text-sm"
              onClick={() => navigate("/lending?tab=supply")}
            >
              <TrendingUp size={14} />
              Earn Interest
            </Button>
          </div>

          {/* Compact Gold Price Banner */}
          <div className="bg-[#2C2C2E] rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[#f9b006] font-bold text-sm">Gold Price</span>
                <div className="text-white font-semibold text-sm">
                  {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_oz.toFixed(2)}/oz` : "N/A"}
                </div>
              </div>
              {priceLoading ? (
                <div className="animate-pulse">
                  <div className="h-3 w-12 bg-gray-600 rounded"></div>
                </div>
              ) : goldPrice && (
                <div className="flex items-center gap-1 text-[#f9b006]">
                  <TrendingUp size={12} />
                  <span className="text-xs font-medium">
                    {goldPrice.change_percent_24h >= 0 ? "+" : ""}{goldPrice.change_percent_24h.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Portfolio Summary with Asset Allocation - Optimized */}
          {!portfolioLoading && (
            <div className="bg-[#2C2C2E] rounded-xl p-3">
              <PortfolioSummaryCard 
                summary={portfolioSummary} 
                performance={portfolioPerformance}
                assets={portfolioAssets}
              />
            </div>
          )}

          {/* Consolidated Token Overview */}
          <div className="bg-[#2C2C2E] rounded-xl p-3">
            <h3 className="text-white text-sm font-bold mb-2">Your Assets</h3>
            <div className="grid grid-cols-2 gap-2">
              {tokens.map((token, index) => (
                <div key={index} className="bg-[#1A1A1A] rounded-lg p-2 flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#2C2C2E] rounded-full flex items-center justify-center text-xs">
                    {token.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-xs truncate">{token.amount} {token.symbol}</p>
                    <p className="text-gray-400 text-xs">{token.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compact Portfolio Positions */}
          {!portfolioLoading && (
            <div className="bg-[#2C2C2E] rounded-xl p-3">
              <PositionsCard assetsByType={assetsByType} />
            </div>
          )}

          {/* Compact Gold Price Chart */}
          <div className="bg-[#2C2C2E] rounded-xl p-3">
            <div className="h-48">
              <GoldPriceChart />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Index;
