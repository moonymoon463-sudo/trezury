import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, TrendingUp, ShoppingCart, DollarSign, ArrowRightLeft, Plus } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const tokens = [
    {
      name: "PAX Gold",
      symbol: "PAXG",
      amount: "81.84",
      value: "$6,172.84",
      icon: "🏅" // Placeholder for token icon
    },
    {
      name: "Tether Gold", 
      symbol: "XAUT",
      amount: "81.84",
      value: "$6,172.84",
      icon: "🥇" // Placeholder for token icon
    },
    {
      name: "USD Coin",
      symbol: "USDC", 
      amount: "0.00",
      value: "$0.00",
      icon: "💲" // Placeholder for token icon
    }
  ];

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-[#1A1A1A] justify-between">
      <div className="flex-grow">
        {/* Header */}
        <div className="flex items-center bg-[#1A1A1A] p-4 pb-2 justify-between sticky top-0 z-10">
          <div className="w-12"></div>
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            Dashboard
          </h2>
          <div className="flex w-12 items-center justify-end">
            <button className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 w-10 bg-transparent text-white hover:bg-white/10 transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-6 pb-4 space-y-6">
          {/* Gold Price Section */}
          <div className="bg-[#2C2C2E] rounded-xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">
                Gold Price
              </h3>
              <div className="flex items-center gap-1 text-[#f9b006]">
                <TrendingUp size={16} />
                <span className="text-sm font-medium">+2.15%</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between gap-x-6 py-1">
                <p className="text-gray-400 text-sm font-normal">USD/oz</p>
                <p className="text-white text-sm font-semibold text-right">$2,345.67</p>
              </div>
              <div className="flex justify-between gap-x-6 py-1">
                <p className="text-gray-400 text-sm font-normal">USD/g</p>
                <p className="text-white text-sm font-semibold text-right">$75.43</p>
              </div>
            </div>
          </div>

          {/* Portfolio Summary */}
          <div className="bg-[#2C2C2E] rounded-xl p-4">
            <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] mb-4">
              Portfolio Summary
            </h3>
            <div className="mb-4">
              <p className="text-gray-400 text-sm font-normal mb-1">Total USD Value</p>
              <p className="text-white text-2xl font-bold">$12,345.67</p>
            </div>
            <div className="flex justify-between">
              <div>
                <p className="text-gray-400 text-sm font-normal mb-1">Total Grams</p>
                <p className="text-white text-lg font-semibold">163.67 g</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm font-normal mb-1">Tokens Held</p>
                <p className="text-white text-lg font-semibold">163.67</p>
              </div>
            </div>
          </div>

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
            <Button className="bg-[#2C2C2E] text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-[#2C2C2E]/80">
              <Plus size={16} />
              Add USDC
            </Button>
          </div>

          {/* Your Tokens */}
          <div>
            <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] mb-4">
              Your Tokens
            </h3>
            <div className="space-y-3">
              {tokens.map((token, index) => (
                <div key={index} className="bg-[#2C2C2E] rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1A1A1A] rounded-full flex items-center justify-center text-xl">
                      {token.icon}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{token.name}</p>
                      <p className="text-gray-400 text-sm">{token.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">{token.amount}</p>
                    <p className="text-gray-400 text-sm">{token.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gold Price Chart */}
          <div className="bg-[#2C2C2E] rounded-xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">
                Gold Price Chart
              </h3>
              <div className="flex bg-[#1A1A1A] rounded-lg p-1">
                <button className="bg-[#f9b006] text-black px-3 py-1 rounded-md text-sm font-semibold">
                  24h
                </button>
                <button className="text-gray-400 px-3 py-1 text-sm font-semibold">
                  7d
                </button>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-white text-2xl font-bold">$2,345.67</p>
              <p className="text-green-500 text-sm">+5.12% ($114.21)</p>
            </div>
            {/* Chart placeholder - would use a real chart library like recharts in production */}
            <div className="h-32 bg-[#1A1A1A] rounded-lg flex items-center justify-center">
              <p className="text-gray-400 text-sm">Chart visualization would go here</p>
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
