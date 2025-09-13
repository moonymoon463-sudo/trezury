import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";

const SellGoldConfirmation = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-[#111111]">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-white hover:bg-gray-800"
          >
            <X size={24} />
          </Button>
          <h1 className="text-lg font-bold text-white">Sell</h1>
          <div className="w-8"></div>
        </div>
        
        {/* Progress Dots */}
        <div className="flex justify-center items-center space-x-2 mt-6 mb-8">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-600"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-gray-600"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#f9b006]"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center text-center px-6">
        {/* Success Icon */}
        <div className="bg-[#f9b006] p-4 rounded-full mb-6">
          <Check size={40} className="text-black" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">You've sold your gold</h2>
        <p className="text-gray-400 mb-8 max-w-sm">
          Your sale is complete. The funds will be available in your account within 1-3 business days.
        </p>

        {/* Sale Details */}
        <div className="w-full">
          <h3 className="text-lg font-bold text-white mb-4 text-left">Sale Details</h3>
          <div className="w-full bg-[#1C1C1C] rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Amount Sold</span>
              <span className="text-white font-medium">0.001g</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Price per gram</span>
              <span className="text-white font-medium">$65.00</span>
            </div>

            <div className="border-t border-gray-600 my-4"></div>

            <div className="flex justify-between items-center">
              <span className="text-white font-bold">Total</span>
              <span className="text-white font-bold">$0.06</span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Button */}
      <div className="p-6">
        <Button 
          className="w-full h-14 bg-[#f9b006] text-black font-bold text-lg rounded-xl hover:bg-[#f9b006]/90"
          onClick={() => navigate("/")}
        >
          Done
        </Button>
      </div>
    </div>
  );
};

export default SellGoldConfirmation;