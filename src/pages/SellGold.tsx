import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, Home, DollarSign, ArrowLeftRight, History, Settings } from "lucide-react";

const SellGold = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col justify-between bg-[#111111] text-white">
      <div className="flex-grow">
        {/* Header */}
        <header className="flex items-center p-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-white hover:bg-gray-800"
          >
            <X size={24} />
          </Button>
          <h1 className="flex-1 text-center text-lg font-bold">Sell/Cash Out</h1>
          <div className="w-10"></div>
        </header>

        {/* Main Content */}
        <main className="p-4">
          <h2 className="text-2xl font-bold mb-8">Which gold token would you like to sell?</h2>
          
          <div className="space-y-4">
            {/* PAXG Option */}
            <button className="flex items-center gap-4 rounded-lg bg-[#1C1C1E] p-4 transition-colors hover:bg-[#2C2C2E] w-full text-left">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-green-700 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">PAXG</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold text-white">PAXG</p>
                <p className="text-sm text-gray-400">Pax Gold</p>
              </div>
              <ChevronRight size={20} className="text-gray-500" />
            </button>

            {/* XAUT Option */}
            <button className="flex items-center gap-4 rounded-lg bg-[#1C1C1E] p-4 transition-colors hover:bg-[#2C2C2E] w-full text-left">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-green-800 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">XAUT</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold text-white">XAUT</p>
                <p className="text-sm text-gray-400">Tether Gold</p>
              </div>
              <ChevronRight size={20} className="text-gray-500" />
            </button>
          </div>
        </main>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-[#1C1C1C] px-4 py-3">
        <div className="flex justify-around items-center">
          <button 
            onClick={() => navigate("/")}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            <Home size={24} />
            <span className="text-xs">Dashboard</span>
          </button>
          
          <button className="flex flex-col items-center gap-1 text-[#f9b006]">
            <div className="bg-[#f9b006] rounded-full p-2">
              <DollarSign size={24} className="text-black" />
            </div>
            <span className="text-xs font-medium">Buy/Sell</span>
          </button>
          
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors">
            <ArrowLeftRight size={24} />
            <span className="text-xs">Swap</span>
          </button>
          
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors">
            <History size={24} />
            <span className="text-xs">History</span>
          </button>
          
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors">
            <Settings size={24} />
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SellGold;