import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, ShoppingCart, RefreshCw } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useTrzryReserves } from "@/hooks/useTrzryReserves";
import TrzryReserveChart from "@/components/TrzryReserveChart";
import { useState } from "react";

const TrzryReserves = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getBalance, loading: balanceLoading, refreshBalances } = useWalletBalance();
  const { reserveValue, totalXautBalance, growthPercentage, loading: reserveLoading, refreshReserves } = useTrzryReserves();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get user's TRZRY balance
  const trzryBalance = getBalance('TRZRY');

  // Calculate TRZRY value (assuming 1 TRZRY = proportional to reserve backing)
  const trzryValueUsd = trzryBalance * (reserveValue / Math.max(totalXautBalance, 1));

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshBalances(), refreshReserves()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-[#1A1A1A] justify-between">
      <div className="flex-grow">
        {/* Header */}
        <div className="flex items-center bg-[#1A1A1A] p-4 pb-2 justify-between sticky top-0 z-10">
          <button 
            className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 w-10 bg-transparent text-white hover:bg-white/10 transition-colors"
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-white text-lg font-bold">TRZRY Reserves</h1>
          <button 
            className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 w-10 bg-transparent text-white hover:bg-white/10 transition-colors"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="px-4 pt-6 pb-4 space-y-4">
          {/* Your TRZRY Balance */}
          <div className="bg-[#2C2C2E] rounded-xl p-4">
            <h3 className="text-white text-base font-bold mb-3">Your TRZRY Balance</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-lg font-bold text-black">
                  T
                </div>
                <div>
                  <p className="text-white font-bold text-lg">
                    {balanceLoading ? "Loading..." : `${trzryBalance.toFixed(4)} TRZRY`}
                  </p>
                  <p className="text-gray-400 text-sm">
                    ≈ ${trzryValueUsd.toFixed(2)} USD
                  </p>
                </div>
              </div>
              <Button 
                className="bg-[#f9b006] text-black font-bold h-10 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#f9b006]/90"
                onClick={() => navigate("/swap?to=TRZRY")}
              >
                <ShoppingCart size={14} />
                Buy TRZRY
              </Button>
            </div>
          </div>

          {/* Reserve Information */}
          <div className="bg-[#2C2C2E] rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white text-base font-bold">Gold Reserve Backing</h3>
              {!reserveLoading && growthPercentage !== null && (
                <div className="flex items-center gap-1 text-green-400">
                  <TrendingUp size={14} />
                  <span className="text-xs font-medium">
                    +{growthPercentage.toFixed(2)}% (30d)
                  </span>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Total Reserve Value</span>
                <span className="text-white text-lg font-bold">
                  {reserveLoading ? "Loading..." : `$${reserveValue.toLocaleString()}`}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Gold Holdings (XAUT)</span>
                <span className="text-white font-semibold">
                  {reserveLoading ? "Loading..." : `${totalXautBalance.toFixed(4)} oz`}
                </span>
              </div>
              
              <div className="bg-[#1A1A1A] rounded-lg p-3 mt-3">
                <p className="text-gray-300 text-xs leading-relaxed">
                  Each TRZRY token is backed by real gold reserves held in secure vaults. 
                  The reserve grows over time through yield generation and strategic acquisitions, 
                  ensuring your tokens maintain and grow their underlying value.
                </p>
              </div>
            </div>
          </div>

          {/* Reserve Growth Chart */}
          <TrzryReserveChart />

          {/* Key Features */}
          <div className="bg-[#2C2C2E] rounded-xl p-4">
            <h3 className="text-white text-base font-bold mb-3">Why TRZRY?</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#f9b006] rounded-full flex items-center justify-center text-xs font-bold text-black mt-0.5">
                  1
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Gold-Backed Security</p>
                  <p className="text-gray-400 text-xs">Each token is backed by physical gold reserves (XAUT)</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#f9b006] rounded-full flex items-center justify-center text-xs font-bold text-black mt-0.5">
                  2
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Growing Reserves</p>
                  <p className="text-gray-400 text-xs">Reserve value increases over time through yield strategies</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#f9b006] rounded-full flex items-center justify-center text-xs font-bold text-black mt-0.5">
                  3
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Full Transparency</p>
                  <p className="text-gray-400 text-xs">Real-time visibility into reserve holdings and growth</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default TrzryReserves;