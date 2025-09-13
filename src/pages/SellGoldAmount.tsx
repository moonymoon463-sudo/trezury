import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, DollarSign, ArrowLeftRight, History, Settings } from "lucide-react";

const SellGoldAmount = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("0.00");
  const [selectedUnit, setSelectedUnit] = useState("USD");

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col justify-between bg-[#1C1C1E] text-white">
      <div className="flex flex-col flex-1">
        {/* Header */}
        <header className="flex items-center p-4 pb-2 justify-between sticky top-0 bg-[#1C1C1E] z-10">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/sell-gold")}
            className="text-white hover:bg-white/10 rounded-full w-10 h-10"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-white text-lg font-bold flex-1 text-center pr-10">Sell Gold</h1>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 py-8 space-y-8">
          <div className="text-center">
            <h2 className="text-white text-3xl font-bold mb-4">How much would you like to sell?</h2>
            <p className="text-gray-400 text-sm">You have 12.5 GOLD ($1,250.00) available.</p>
          </div>

          <div className="flex flex-col items-center gap-4">
            {/* Amount Input */}
            <div className="relative w-full max-w-sm">
              <input 
                className="w-full text-center text-5xl font-bold text-white bg-transparent border-none focus:ring-0 p-0 outline-none"
                placeholder="$0.00"
                type="text"
                value={`$${amount}`}
                onChange={(e) => setAmount(e.target.value.replace('$', ''))}
              />
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-gray-400 text-sm">~ 0 GOLD</span>
            </div>

            {/* Currency Toggle */}
            <div className="flex items-center justify-center rounded-full bg-[#2C2C2E] p-1">
              <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-full px-4 py-1.5 text-sm font-semibold leading-normal transition-all duration-300 ease-in-out ${
                selectedUnit === 'USD' ? 'bg-[#f9b006] text-[#1C1C1E] shadow-lg' : 'text-gray-300'
              }`}>
                <span className="truncate">USD</span>
                <input 
                  className="invisible w-0" 
                  name="unit" 
                  type="radio" 
                  value="USD"
                  checked={selectedUnit === 'USD'}
                  onChange={() => setSelectedUnit('USD')}
                />
              </label>
              
              <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-full px-4 py-1.5 text-sm font-semibold leading-normal transition-all duration-300 ease-in-out ${
                selectedUnit === 'Tokens' ? 'bg-[#f9b006] text-[#1C1C1E] shadow-lg' : 'text-gray-300'
              }`}>
                <span className="truncate">Tokens</span>
                <input 
                  className="invisible w-0" 
                  name="unit" 
                  type="radio" 
                  value="Tokens"
                  checked={selectedUnit === 'Tokens'}
                  onChange={() => setSelectedUnit('Tokens')}
                />
              </label>
              
              <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-full px-4 py-1.5 text-sm font-semibold leading-normal transition-all duration-300 ease-in-out ${
                selectedUnit === 'Grams' ? 'bg-[#f9b006] text-[#1C1C1E] shadow-lg' : 'text-gray-300'
              }`}>
                <span className="truncate">Grams</span>
                <input 
                  className="invisible w-0" 
                  name="unit" 
                  type="radio" 
                  value="Grams"
                  checked={selectedUnit === 'Grams'}
                  onChange={() => setSelectedUnit('Grams')}
                />
              </label>
            </div>
          </div>
        </main>

        {/* Continue Button */}
        <div className="px-4 pb-6">
          <Button 
            className="w-full h-14 bg-[#f9b006] text-black font-bold text-lg rounded-xl hover:bg-[#f9b006]/90"
            onClick={() => navigate("/sell-gold/payout")}
          >
            Continue
          </Button>
        </div>
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

export default SellGoldAmount;