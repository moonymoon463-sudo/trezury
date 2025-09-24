import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, DollarSign, ArrowRightLeft } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import AurumLogo from "@/components/AurumLogo";

const BuySellHub = () => {
  const navigate = useNavigate();
  const { price: goldPrice, loading: priceLoading } = useGoldPrice();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="h-16 bg-background border-b border-border flex items-center px-4 flex-shrink-0">
        <div className="w-12 flex justify-start">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-foreground hover:bg-surface-elevated h-10 w-10"
          >
            <ArrowLeft size={20} />
          </Button>
        </div>
        
        <div className="flex-1 flex justify-center">
          <div className="h-12 flex items-center">
            <AurumLogo compact />
          </div>
        </div>
        
        <div className="w-12"></div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-4">
        <div className="max-w-md mx-auto space-y-6 pt-4">
          {/* Gold Price Section */}
          <div className="bg-[#2C2C2E] rounded-xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">
                Current Gold Price
              </h3>
              {priceLoading ? (
                <div className="animate-pulse">
                  <div className="h-4 w-16 bg-gray-600 rounded"></div>
                </div>
              ) : goldPrice && (
                <div className="flex items-center gap-1 text-[#f9b006]">
                  <TrendingUp size={16} />
                  <span className="text-sm font-medium">
                    {goldPrice.change_percent_24h >= 0 ? "+" : ""}{goldPrice.change_percent_24h.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between gap-x-6 py-1">
                <p className="text-gray-400 text-sm font-normal">USD/oz</p>
                <p className="text-white text-sm font-semibold text-right">
                  {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_oz.toFixed(2)}` : "N/A"}
                </p>
              </div>
              <div className="flex justify-between gap-x-6 py-1">
                <p className="text-gray-400 text-sm font-normal">USD/g</p>
                <p className="text-white text-sm font-semibold text-right">
                  {priceLoading ? "Loading..." : goldPrice ? `$${goldPrice.usd_per_gram.toFixed(2)}` : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="space-y-4">
            <div 
              onClick={() => navigate("/buy-gold")}
              className="bg-[#2C2C2E] rounded-xl p-6 cursor-pointer hover:bg-[#2C2C2E]/80 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#f9b006] rounded-full flex items-center justify-center">
                  <TrendingUp size={24} className="text-black" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white text-lg font-bold mb-1">Buy Gold</h3>
                  <p className="text-gray-400 text-sm">
                    Purchase physical gold backed tokens with Credit card or USDC
                  </p>
                </div>
                <ArrowRightLeft size={20} className="text-gray-400 rotate-90" />
              </div>
            </div>

            <div 
              onClick={() => navigate("/sell-gold")}
              className="bg-[#2C2C2E] rounded-xl p-6 cursor-pointer hover:bg-[#2C2C2E]/80 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#2C2C2E] border-2 border-[#f9b006] rounded-full flex items-center justify-center">
                  <DollarSign size={24} className="text-[#f9b006]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white text-lg font-bold mb-1">Sell Gold</h3>
                  <p className="text-gray-400 text-sm">
                    Convert your gold tokens back to USDC or Fiat
                  </p>
                </div>
                <ArrowRightLeft size={20} className="text-gray-400 rotate-90" />
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-[#2C2C2E] rounded-xl p-4">
            <h4 className="text-white font-semibold mb-3">How it works</h4>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-[#f9b006] rounded-full flex items-center justify-center text-black font-bold text-xs">
                  1
                </div>
                <div>
                  <p className="text-white font-medium">Choose your transaction</p>
                  <p className="text-gray-400">Select buy or sell based on your needs</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-[#f9b006] rounded-full flex items-center justify-center text-black font-bold text-xs">
                  2
                </div>
                <div>
                  <p className="text-white font-medium">Enter amount</p>
                  <p className="text-gray-400">Specify how much you want to buy or sell</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-[#f9b006] rounded-full flex items-center justify-center text-black font-bold text-xs">
                  3
                </div>
                <div>
                  <p className="text-white font-medium">Confirm transaction</p>
                  <p className="text-gray-400">Review details and complete your trade</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="bg-[#f9b006] text-black font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-[#f9b006]/90"
              onClick={() => navigate("/buy-gold")}
            >
              <TrendingUp size={16} />
              Quick Buy
            </Button>
            <Button 
              className="bg-[#2C2C2E] border-2 border-[#f9b006] text-[#f9b006] font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-[#f9b006] hover:text-black transition-colors"
              onClick={() => navigate("/sell-gold")}
            >
              <DollarSign size={16} />
              Quick Sell
            </Button>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default BuySellHub;