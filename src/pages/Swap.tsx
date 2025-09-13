import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronDown, ArrowUpDown, Edit } from "lucide-react";

const Swap = () => {
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
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">Swap</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4">
        {/* Swap Interface */}
        <div className="relative flex flex-col gap-2 my-8">
          {/* From Section */}
          <div className="bg-[#2C2C2E] p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">From</span>
              <span className="text-sm text-gray-400">Balance: 1,234.56</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">USDC</span>
                </div>
                <span className="text-white text-lg font-bold">USDC</span>
                <ChevronDown className="text-gray-400" size={20} />
              </div>
              <Input
                className="bg-transparent border-none text-white text-right text-2xl font-bold placeholder:text-gray-500 focus:ring-0"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Swap Button */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <Button 
              variant="ghost" 
              size="icon"
              className="bg-[#48484A] rounded-full p-2 text-white border-4 border-[#2C2C2E] hover:bg-[#48484A]/80"
            >
              <ArrowUpDown size={20} />
            </Button>
          </div>

          {/* To Section */}
          <div className="bg-[#2C2C2E] p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">To</span>
              <span className="text-sm text-gray-400">Balance: 0.00</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">XAUT</span>
                </div>
                <span className="text-white text-lg font-bold">XAUT</span>
                <ChevronDown className="text-gray-400" size={20} />
              </div>
              <Input
                className="bg-transparent border-none text-white text-right text-2xl font-bold placeholder:text-gray-500 focus:ring-0"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Trading Details */}
        <div className="space-y-3 mb-8">
          <div className="flex justify-between items-center bg-[#2C2C2E] p-4 rounded-xl">
            <span className="text-white">Slippage Tolerance</span>
            <div className="flex items-center gap-2">
              <span className="text-white">0.5%</span>
              <Edit className="text-gray-400" size={16} />
            </div>
          </div>

          <div className="flex justify-between items-center bg-[#2C2C2E] p-4 rounded-xl">
            <span className="text-white">Gas Estimate</span>
            <span className="text-white">~$5.32</span>
          </div>

          <div className="flex justify-between items-center bg-[#2C2C2E] p-4 rounded-xl">
            <span className="text-white">Route</span>
            <span className="text-white">USDC → XAUT</span>
          </div>
        </div>
      </main>

      {/* Bottom Button */}
      <div className="p-6">
        <Button 
          className="w-full h-14 bg-[#f9b006] text-black font-bold text-lg rounded-xl hover:bg-[#f9b006]/90"
        >
          Preview Swap
        </Button>
      </div>
    </div>
  );
};

export default Swap;