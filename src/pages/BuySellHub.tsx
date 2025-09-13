import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";

const BuySellHub = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-[#1C1C1E]">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-white hover:bg-gray-800"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">Buy/Sell</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4">
        {/* Gold Price Section */}
        <div className="mb-8">
          <div className="bg-[#2C2C2E] p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f9b006] rounded-full flex items-center justify-center">
                <div className="w-6 h-6 bg-black rounded-sm flex items-center justify-center">
                  <div className="w-4 h-4 bg-[#f9b006] transform rotate-45"></div>
                </div>
              </div>
              <div>
                <h2 className="text-white text-lg font-semibold">Gold Price</h2>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">$2,678.45</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp size={16} className="text-green-500" />
                    <span className="text-green-500 text-sm">+1.2%</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Per troy ounce</p>
          </div>
        </div>

        {/* Your Gold Balance */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Your Gold</h2>
          <div className="bg-[#2C2C2E] p-6 rounded-xl">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-2">Total Balance</p>
              <p className="text-3xl font-bold text-white mb-1">1.23456 oz</p>
              <p className="text-xl text-gray-300">≈ $3,305.67</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 mb-8">
          <Button
            onClick={() => navigate("/buy-gold")}
            className="w-full h-14 bg-[#f9b006] hover:bg-[#e6a005] text-black font-semibold rounded-xl"
          >
            Buy Gold
          </Button>
          
          <Button
            onClick={() => navigate("/sell-gold")}
            variant="outline"
            className="w-full h-14 border-gray-600 text-white hover:bg-gray-800 font-semibold rounded-xl"
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