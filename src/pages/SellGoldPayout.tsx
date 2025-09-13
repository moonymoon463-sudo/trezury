import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, Home, DollarSign, ArrowLeftRight, History, Settings, CircleDollarSign, Building2 } from "lucide-react";

const SellGoldPayout = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col justify-between overflow-x-hidden bg-[#111111] text-white">
      <div className="flex-grow">
        {/* Header */}
        <header className="flex items-center p-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/sell-gold/amount")}
            className="text-white hover:bg-gray-800"
          >
            <X size={24} />
          </Button>
          <h1 className="flex-1 text-center text-lg font-bold">Sell</h1>
          <div className="w-10"></div>
        </header>

        {/* Main Content */}
        <main className="px-4 pt-6 pb-8">
          <h2 className="text-2xl font-bold mb-6">Choose your payout method</h2>
          
          <div className="space-y-4">
            {/* USDC Option */}
            <button className="flex items-center gap-4 rounded-lg bg-[#1C1C1E] p-4 transition-colors hover:bg-[#2C2C2E] w-full text-left">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#2C2C2E]">
                <CircleDollarSign size={24} className="text-[#f9b006]" />
              </div>
              <div className="flex-grow">
                <p className="text-base font-semibold">USDC</p>
                <p className="text-sm text-gray-400">Receive USDC in your wallet</p>
              </div>
              <ChevronRight size={20} className="text-gray-500" />
            </button>

            {/* Bank via Ramp Option */}
            <button className="flex items-center gap-4 rounded-lg bg-[#1C1C1E] p-4 transition-colors hover:bg-[#2C2C2E] w-full text-left">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#2C2C2E]">
                <Building2 size={24} className="text-[#f9b006]" />
              </div>
              <div className="flex-grow">
                <p className="text-base font-semibold">Bank via Ramp</p>
                <p className="text-sm text-gray-400">Receive USD in your bank account</p>
              </div>
              <ChevronRight size={20} className="text-gray-500" />
            </button>
          </div>
        </main>
      </div>

      {/* Bottom Navigation */}
      <div className="sticky bottom-0 border-t border-gray-800 bg-[#1C1C1E] pb-3 pt-2">
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

export default SellGoldPayout;