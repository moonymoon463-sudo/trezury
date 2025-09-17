import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet2, DollarSign, ChevronRight, Shield } from "lucide-react";
import AurumLogo from "@/components/AurumLogo";

const Wallet = () => {
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
          <div className="flex-1 flex justify-center pr-6">
            <AurumLogo compact />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4">
        {/* Your Wallet Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">Your Wallet</h2>
          <div className="bg-[#2C2C2E] p-4 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#48484A] rounded-full flex items-center justify-center">
                <Wallet2 className="text-white" size={24} />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Active Wallet</p>
                <p className="text-white text-base font-medium">App Custodial Wallet</p>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-6">Balance</h2>
          <div className="space-y-3">
            {/* USD Balance */}
            <div className="bg-[#2C2C2E] p-4 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#48484A] rounded-full flex items-center justify-center">
                  <DollarSign className="text-white" size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-gray-400 text-sm">USD</p>
                  <p className="text-white text-xl font-bold">$1,234.56</p>
                </div>
              </div>
            </div>

            {/* Gold Balance */}
            <div className="bg-[#2C2C2E] p-4 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#f9b006] rounded-full flex items-center justify-center">
                  <div className="w-6 h-6 bg-black rounded-sm flex items-center justify-center">
                    <div className="w-4 h-4 bg-[#f9b006] transform rotate-45"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-gray-400 text-sm">Gold</p>
                  <p className="text-white text-xl font-bold">1.23456 oz</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manage Custodial Wallet */}
        <div className="mb-8">
          <div className="bg-[#2C2C2E] p-4 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#48484A] rounded-full flex items-center justify-center">
                <Shield className="text-white" size={24} />
              </div>
              <div className="flex-1">
                <p className="text-white text-base font-medium">Manage Custodial Wallet</p>
              </div>
              <ChevronRight className="text-gray-400" size={20} />
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-[#2C2C2E] px-6 py-4">
        <div className="flex justify-around">
          <button 
            onClick={() => navigate("/")}
            className="flex flex-col items-center space-y-1"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-gray-400"></div>
            </div>
            <span className="text-xs text-gray-400">Home</span>
          </button>
          
          <button 
            onClick={() => navigate("/buy-gold")}
            className="flex flex-col items-center space-y-1"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-gray-400 border-b-0"></div>
            </div>
            <span className="text-xs text-gray-400">Buy/Sell</span>
          </button>
          
          <button 
            onClick={() => navigate("/swap")}
            className="flex flex-col items-center space-y-1"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-gray-400 transform rotate-45"></div>
              <div className="w-3 h-3 border-2 border-gray-400 transform -rotate-45 -ml-2"></div>
            </div>
            <span className="text-xs text-gray-400">Swap</span>
          </button>
          
          <button className="flex flex-col items-center space-y-1">
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-gray-400 rounded-full"></div>
            </div>
            <span className="text-xs text-gray-400">History</span>
          </button>
          
          <button className="flex flex-col items-center space-y-1">
            <div className="w-6 h-6 flex items-center justify-center">
              <div className="w-4 h-4 bg-[#f9b006] rounded"></div>
            </div>
            <span className="text-xs text-[#f9b006]">Wallet</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Wallet;