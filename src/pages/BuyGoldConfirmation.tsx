import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Copy } from "lucide-react";

const BuyGoldConfirmation = () => {
  const navigate = useNavigate();

  const handleCopyTransactionId = () => {
    navigator.clipboard.writeText("#123...xyz");
  };

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
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-lg font-bold text-white">Buy Gold</h1>
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

        <h2 className="text-2xl font-bold text-white mb-3">Purchase Confirmed</h2>
        <p className="text-gray-400 mb-8">
          Your purchase of 0.001 oz of Gold has been successfully completed.
        </p>

        {/* Transaction Details */}
        <div className="w-full bg-[#1C1C1C] rounded-xl p-6 space-y-5">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Amount</span>
            <span className="text-white font-medium">0.001 oz</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400">Total</span>
            <span className="text-white font-medium">$2.34</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400">Payment Method</span>
            <span className="text-white font-medium">Gold Wallet</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400">Time</span>
            <span className="text-white font-medium">12:30 PM</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400">Transaction ID</span>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">#123...xyz</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyTransactionId}
                className="h-6 w-6 text-gray-400 hover:text-white"
              >
                <Copy size={16} />
              </Button>
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
          View in History
        </Button>
      </div>
    </div>
  );
};

export default BuyGoldConfirmation;