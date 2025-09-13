import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, TrendingUp, ShoppingCart, DollarSign, ArrowRightLeft, Plus } from "lucide-react";

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
              onClick={() => navigate("/buy-gold")}
            >
              <ShoppingCart size={16} />
              Buy Gold
            </Button>
            <Button className="bg-[#2C2C2E] text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-[#2C2C2E]/80">
              <DollarSign size={16} />
              Sell/Cash Out
            </Button>
            <Button className="bg-[#2C2C2E] text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-[#2C2C2E]/80">
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
      <nav className="flex items-center justify-around bg-[#1A1A1A] py-4 px-6 border-t border-[#2C2C2E]">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 bg-[#f9b006] rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </div>
          <span className="text-xs text-white mt-1">Dashboard</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#6a582f]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
            </svg>
          </div>
          <span className="text-xs text-[#6a582f] mt-1">Buy/Sell</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#6a582f]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/>
            </svg>
          </div>
          <span className="text-xs text-[#6a582f] mt-1">Swap</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#6a582f]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13,3A9,9 0 0,0 4,12H1L4.5,15.5L8,12H5A7,7 0 0,1 12,5A7,7 0 0,1 19,12A7,7 0 0,1 12,19C10.5,19 9.09,18.5 7.94,17.7L6.5,19.14C8.04,20.3 9.94,21 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3H13Z"/>
            </svg>
          </div>
          <span className="text-xs text-[#6a582f] mt-1">History</span>
        </div>
      </nav>
    </div>
  );
};

export default Index;
