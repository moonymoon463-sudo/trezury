import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { useSellQuote } from "@/hooks/useSellQuote";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { quoteEngineService } from "@/services/quoteEngine";

const SellGoldAmount = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [amount, setAmount] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("USD");

  const asset = location.state?.asset || 'GOLD';
  const { price: goldPrice } = useGoldPrice();
  const { quote, loading: quoteLoading, generateQuote } = useSellQuote();
  const { getBalance, loading: balanceLoading } = useWalletBalance();
  
  const goldBalance = getBalance('GOLD');
  const goldBalanceValue = goldPrice ? quoteEngineService.calculateGramsToUsd(goldBalance, goldPrice.usd_per_gram) : 0;

  const handleAmountChange = (value: string) => {
    // Remove any non-numeric characters except decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');
    setAmount(cleanValue);
  };

  const getQuickAmount = (percentage: number) => {
    if (selectedUnit === "USD") {
      const usdValue = goldBalanceValue * percentage;
      return usdValue.toFixed(2);
    } else {
      // GRAMS
      const gramsValue = goldBalance * percentage;
      return gramsValue.toFixed(3);
    }
  };

  const calculateDisplayValue = () => {
    if (!goldPrice || !amount) return "";
    const numericAmount = parseFloat(amount) || 0;
    
    if (selectedUnit === "USD") {
      const grams = quoteEngineService.calculateUsdToGrams(numericAmount, goldPrice.usd_per_gram);
      return `≈ ${grams.toFixed(3)} grams`;
    } else {
      const usd = quoteEngineService.calculateGramsToUsd(numericAmount, goldPrice.usd_per_gram);
      return `≈ $${usd.toFixed(2)}`;
    }
  };

  // Generate quote when amount changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      const numericAmount = parseFloat(amount);
      if (numericAmount > 0 && goldPrice) {
        const request = selectedUnit === "USD"
          ? {
              side: 'sell' as const,
              inputAsset: 'GOLD' as const,
              outputAsset: 'USDC' as const,
              outputAmount: numericAmount
            }
          : {
              side: 'sell' as const,
              inputAsset: 'GOLD' as const,
              outputAsset: 'USDC' as const,
              grams: numericAmount
            };
        
        generateQuote(request);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [amount, selectedUnit, goldPrice, generateQuote]);

  return (
    <div className="flex flex-col h-screen bg-[#1C1C1E] text-white">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/sell-gold")}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">Sell {asset}</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8">
        {/* Gold Balance */}
        <div className="text-center mb-8">
          <p className="text-sm text-gray-400">Available Balance</p>
          {balanceLoading ? (
            <div className="animate-pulse">
              <div className="h-8 w-32 bg-gray-700 rounded mx-auto"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-white">
                {goldBalance.toFixed(3)} {asset}
              </p>
              <p className="text-lg text-gray-400">
                ≈ ${goldBalanceValue.toFixed(2)}
              </p>
            </>
          )}
        </div>

        {/* Unit Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-full bg-gray-800 p-1">
            <button 
              className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                selectedUnit === "USD" 
                  ? "bg-yellow-500 text-black" 
                  : "text-gray-400"
              }`}
              onClick={() => setSelectedUnit("USD")}
            >
              USD
            </button>
            <button 
              className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                selectedUnit === "GRAMS" 
                  ? "bg-yellow-500 text-black" 
                  : "text-gray-400"
              }`}
              onClick={() => setSelectedUnit("GRAMS")}
            >
              Grams
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div className="text-center mb-8">
          <div className="relative">
            {selectedUnit === "USD" && (
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-white pointer-events-none -ml-8">
                $
              </span>
            )}
            <input 
              className="w-full text-center text-6xl font-bold text-white bg-transparent border-none focus:ring-0 p-0 outline-none placeholder-gray-500"
              placeholder={selectedUnit === "USD" ? "0.00" : "0.000"}
              type="text"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
            />
            {selectedUnit === "GRAMS" && (
              <span className="text-xl text-gray-400 ml-2">g</span>
            )}
          </div>
          
          {/* Real-time conversion with loading state */}
          <div className="mt-4 min-h-[2rem]">
            {quoteLoading ? (
              <div className="flex items-center justify-center gap-2 text-gray-400">
                <Loader2 size={16} className="animate-spin" />
                <span>Calculating...</span>
              </div>
            ) : quote ? (
              <>
                <p className="text-gray-400 mb-2">
                  {selectedUnit === "USD"
                    ? `You will sell ${quote.grams.toFixed(3)} grams`
                    : `You will receive $${quote.outputAmount.toFixed(2)}`
                  }
                </p>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Fee: ${quote.feeUsd.toFixed(2)} ({(quote.feeBps / 100).toFixed(1)}%)</p>
                  <p>Gold price: ${quote.unitPriceUsd.toFixed(2)}/oz</p>
                  <p>Net amount: ${(quote.outputAmount - quote.feeUsd).toFixed(2)}</p>
                </div>
              </>
            ) : amount && goldPrice ? (
              <p className="text-gray-400">
                {calculateDisplayValue()}
              </p>
            ) : (
              <p className="text-gray-500">Enter amount to see quote</p>
            )}
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-3 gap-4">
          <Button 
            variant="outline"
            className="py-6 text-lg font-semibold bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            onClick={() => setAmount(getQuickAmount(0.25))}
          >
            25%
          </Button>
          <Button 
            variant="outline"
            className="py-6 text-lg font-semibold bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            onClick={() => setAmount(getQuickAmount(0.5))}
          >
            50%
          </Button>
          <Button 
            variant="outline"
            className="py-6 text-lg font-semibold bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            onClick={() => setAmount(getQuickAmount(1))}
          >
            Max
          </Button>
        </div>
      </main>

      {/* Continue Button */}
      <div className="px-4 py-6">
        <Button 
          className="w-full h-14 font-bold text-lg rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black disabled:bg-gray-700 disabled:text-gray-400"
          disabled={!amount || parseFloat(amount) <= 0 || !quote || quote.grams > goldBalance}
          onClick={() => {
            sessionStorage.setItem('sellAmount', amount);
            sessionStorage.setItem('sellUnit', selectedUnit);
            navigate("/sell-gold/confirmation", { state: { quote, asset } });
          }}
        >
          {quote && quote.grams > goldBalance ? "Insufficient Balance" : "Continue"}
        </Button>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default SellGoldAmount;