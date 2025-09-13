import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

const BuyGoldQuote = () => {
  const navigate = useNavigate();
  const [showQuote, setShowQuote] = useState(true);

  // Mock quote data
  const quoteData = {
    estimatedSlippage: 0.00,
    fees: 0.00,
    minimumGoldReceived: "0.00 XAUt"
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-[#111111]">
      {/* Dark overlay background */}
      <div className="absolute inset-0 bg-black/50"></div>
      
      {/* Main content area - empty/dark for backdrop */}
      <div className="flex-1"></div>

      {/* Quote Bottom Sheet */}
      {showQuote && (
        <div className="relative flex flex-col items-stretch bg-[#1C1C1C] rounded-t-3xl">
          {/* Drag handle */}
          <div className="flex h-8 w-full items-center justify-center flex-shrink-0">
            <div className="h-1.5 w-10 rounded-full bg-gray-600"></div>
          </div>
          
          {/* Quote Content */}
          <div className="px-6 pb-8 pt-4">
            <h1 className="text-white text-2xl font-bold leading-tight tracking-tight mb-6">
              Quote
            </h1>
            
            <div className="space-y-4">
              {/* Estimated Slippage */}
              <div className="flex justify-between items-center gap-x-6 py-2 border-b border-gray-700/50">
                <div className="flex items-center gap-x-3">
                  <p className="text-gray-400 text-base font-normal leading-normal">
                    Estimated slippage
                  </p>
                  <Info size={16} className="text-gray-500" />
                </div>
                <p className="text-white text-base font-medium leading-normal text-right">
                  ${quoteData.estimatedSlippage.toFixed(2)}
                </p>
              </div>

              {/* Fees */}
              <div className="flex justify-between items-center gap-x-6 py-2 border-b border-gray-700/50">
                <div className="flex items-center gap-x-3">
                  <p className="text-gray-400 text-base font-normal leading-normal">
                    Fees
                  </p>
                  <Info size={16} className="text-gray-500" />
                </div>
                <p className="text-white text-base font-medium leading-normal text-right">
                  ${quoteData.fees.toFixed(2)}
                </p>
              </div>

              {/* Minimum Gold Received */}
              <div className="flex justify-between items-center gap-x-6 py-2">
                <p className="text-gray-400 text-base font-normal leading-normal">
                  Minimum gold received
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-[#f9b006] text-base font-bold leading-normal text-right">
                    {quoteData.minimumGoldReceived}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 space-y-3">
              <Button 
                className="w-full h-14 bg-[#f9b006] text-black font-bold text-lg rounded-xl hover:bg-[#f9b006]/90"
                onClick={() => navigate("/buy-gold/confirmation")}
              >
                Confirm Purchase
              </Button>
              
              <Button 
                variant="outline"
                className="w-full h-12 border-gray-600 text-gray-400 hover:bg-gray-800 hover:text-white rounded-xl"
                onClick={() => navigate("/buy-gold/asset")}
              >
                Back to Asset Selection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyGoldQuote;