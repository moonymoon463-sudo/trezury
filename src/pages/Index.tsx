import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, TrendingUp, ShoppingCart, DollarSign, ArrowRightLeft, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { usePortfolioMonitoring } from "@/hooks/usePortfolioMonitoring";
import GoldPriceChart from "@/components/GoldPriceChart";
import AurumLogo from "@/components/AurumLogo";
import { QuickPositions } from "@/components/portfolio/QuickPositions";
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
  const [showChart, setShowChart] = useState(false);

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

        <div className="px-4 pt-4 pb-4 space-y-4">
          {/* Compact Gold Price Header */}
          <div className="bg-gradient-to-r from-[#f9b006]/10 to-[#f9b006]/5 border border-[#f9b006]/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[#f9b006] text-sm font-medium">Gold Price</span>
                <button
                  onClick={() => setShowChart(!showChart)}
                  className="text-[#f9b006] hover:text-[#f9b006]/80 transition-colors"
                >
                  {showChart ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              <div className="text-right">
                {priceLoading ? (
                  <div className="animate-pulse">
                    <div className="h-4 w-20 bg-gray-600 rounded"></div>
                  </div>
                ) : goldPrice ? (
                  <div className="space-y-0.5">
                    <p className="text-white text-lg font-bold">${goldPrice.usd_per_oz.toFixed(2)}/oz</p>
                    <div className="flex items-center gap-1 justify-end">
                      <TrendingUp size={12} className="text-[#f9b006]" />
                      <span className="text-[#f9b006] text-xs font-medium">
                        {goldPrice.change_percent_24h >= 0 ? "+" : ""}{goldPrice.change_percent_24h.toFixed(2)}% (24h)
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">N/A</p>
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Gold Price Chart */}
          {showChart && (
            <div className="transform transition-all duration-300 ease-in-out">
              <GoldPriceChart />
            </div>
          )}

          {/* Portfolio Summary with Asset Allocation */}
          {!portfolioLoading && (
            <PortfolioSummaryCard 
              summary={portfolioSummary} 
              performance={portfolioPerformance}
              assets={portfolioAssets}
            />
          )}

          {/* Quick Positions */}
          {!portfolioLoading && (
            <div className="bg-card rounded-xl p-4">
              <QuickPositions assetsByType={assetsByType} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="bg-[#f9b006] text-black font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-[#f9b006]/90"
              onClick={() => navigate("/buy-sell-hub")}
            >
              <ShoppingCart size={16} />
              Buy Gold
            </Button>
            <Button 
              className="bg-[#2C2C2E] text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-[#2C2C2E]/80"
              onClick={() => navigate("/buy-sell-hub")}
            >
              <DollarSign size={16} />
              Sell/Cash Out
            </Button>
            <Button 
              className="bg-[#2C2C2E] text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-[#2C2C2E]/80"
              onClick={() => navigate("/swap")}
            >
              <ArrowRightLeft size={16} />
              Swap
            </Button>
            <Button 
              className="bg-[#2C2C2E] text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-[#2C2C2E]/80"
              onClick={() => navigate("/lending?tab=supply")}
            >
              <TrendingUp size={16} />
              Earn Interest
            </Button>
          </div>

        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Index;
