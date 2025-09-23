import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, CircleDollarSign, Building2 } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";

const SellGoldPayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedMethod, setSelectedMethod] = useState<'usdc' | 'bank' | null>(null);
  
  const quote = location.state?.quote;
  const asset = location.state?.asset || 'GOLD';

  return (
    <div className="flex flex-col min-h-screen bg-[#1C1C1E] text-white">
      {/* Header */}
      <header className="flex-shrink-0 p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/sell-gold/amount", { state: { quote, asset } })}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">Choose Payout</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 pb-32">
        <h2 className="text-2xl font-bold mb-6">Choose your payout method</h2>
        
        <div className="space-y-4">
          {/* USDC Option */}
          <button 
            className={`flex items-center gap-4 rounded-lg p-4 transition-colors w-full text-left ${
              selectedMethod === 'usdc' 
                ? 'bg-yellow-500/20 border-2 border-yellow-500' 
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
            onClick={() => setSelectedMethod('usdc')}
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gray-700">
              <CircleDollarSign size={24} className="text-yellow-500" />
            </div>
            <div className="flex-grow">
              <p className="text-base font-semibold">USDC</p>
              <p className="text-sm text-gray-400">Receive USDC in your wallet</p>
            </div>
            <ChevronRight size={20} className="text-gray-500" />
          </button>

          {/* Bank via MoonPay Option */}
          <button 
            className={`flex items-center gap-4 rounded-lg p-4 transition-colors w-full text-left ${
              selectedMethod === 'bank' 
                ? 'bg-yellow-500/20 border-2 border-yellow-500' 
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
            onClick={() => setSelectedMethod('bank')}
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gray-700">
              <Building2 size={24} className="text-yellow-500" />
            </div>
            <div className="flex-grow">
              <p className="text-base font-semibold">Bank via MoonPay</p>
              <p className="text-sm text-gray-400">Receive USD in your bank account</p>
            </div>
            <ChevronRight size={20} className="text-gray-500" />
          </button>
        </div>
      </main>

      {/* Continue Button */}
      <div className="flex-shrink-0 px-4 py-4 pb-24 bg-[#1C1C1E]">
        <Button 
          className="w-full h-12 bg-yellow-500 text-black font-bold text-lg rounded-xl hover:bg-yellow-600 disabled:bg-gray-700 disabled:text-gray-400"
          disabled={!selectedMethod}
          onClick={() => {
            if (selectedMethod === 'usdc') {
              navigate("/sell-gold/confirmation", { state: { quote, asset, payoutMethod: 'usdc' } });
            } else if (selectedMethod === 'bank') {
              navigate("/sell-gold/confirmation", { state: { quote, asset, payoutMethod: 'bank' } });
            }
          }}
        >
          {selectedMethod === 'bank' ? 'Continue with MoonPay' : 'Complete Sale'}
        </Button>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default SellGoldPayout;