import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { useSellQuote } from "@/hooks/useSellQuote";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useMoonPaySell } from "@/hooks/useMoonPaySell";
import { quoteEngineService } from "@/services/quoteEngine";
import { toast } from "sonner";

const SellGold = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("USD");

  const { price: goldPrice } = useGoldPrice();
  const { quote, loading: quoteLoading, generateQuote } = useSellQuote();
  const { getBalance, loading: balanceLoading } = useWalletBalance();
  const { initiateSell, loading: sellLoading } = useMoonPaySell();
  
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

  const handleSellWithMoonPay = async () => {
    if (!quote) {
      toast.error("Please enter a valid amount first");
      return;
    }

    if (quote.grams > goldBalance) {
      toast.error("Insufficient balance");
      return;
    }

    try {
      const result = await initiateSell({
        amount: quote.outputAmount, // USDC amount
        currency: 'USDC',
        returnUrl: `${window.location.origin}/offramp/return`
      });

      if (result.success && result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch (error) {
      console.error('Error initiating sell:', error);
      toast.error("Failed to initiate sell transaction");
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
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="flex-shrink-0 p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-foreground hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Sell Gold</h1>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto px-4 pb-32">
        {/* Gold Balance */}
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground">Available Balance</p>
          {balanceLoading ? (
            <div className="animate-pulse">
              <div className="h-8 w-32 bg-muted rounded mx-auto"></div>
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-foreground">
                {goldBalance.toFixed(3)} GOLD
              </p>
              <p className="text-base text-muted-foreground">
                ≈ ${goldBalanceValue.toFixed(2)}
              </p>
            </>
          )}
        </div>

        {/* Unit Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-full bg-secondary p-1">
            <button 
              className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                selectedUnit === "USD" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground"
              }`}
              onClick={() => setSelectedUnit("USD")}
            >
              USD
            </button>
            <button 
              className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                selectedUnit === "GRAMS" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground"
              }`}
              onClick={() => setSelectedUnit("GRAMS")}
            >
              Grams
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div className="text-center mb-6">
          <div className="relative">
            {selectedUnit === "USD" && (
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-bold text-foreground pointer-events-none -ml-6">
                $
              </span>
            )}
            <input 
              className="w-full text-center text-3xl sm:text-4xl font-bold text-foreground bg-transparent border-none focus:ring-0 p-0 outline-none placeholder-muted-foreground"
              placeholder={selectedUnit === "USD" ? "0.00" : "0.000"}
              type="text"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
            />
            {selectedUnit === "GRAMS" && (
              <span className="text-lg text-muted-foreground ml-2">g</span>
            )}
          </div>
          
          {/* Real-time conversion with loading state */}
          <div className="mt-3 min-h-[1.5rem]">
            {quoteLoading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                <span>Calculating...</span>
              </div>
            ) : quote ? (
              <>
                <p className="text-muted-foreground mb-2">
                  {selectedUnit === "USD"
                    ? `You will sell ${quote.grams.toFixed(3)} grams`
                    : `You will receive $${quote.outputAmount.toFixed(2)}`
                  }
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Fee: ${quote.feeUsd.toFixed(2)} ({(quote.feeBps / 100).toFixed(1)}%)</p>
                  <p>Gold price: ${quote.unitPriceUsd.toFixed(2)}/oz</p>
                  <p>Net amount: ${(quote.outputAmount - quote.feeUsd).toFixed(2)}</p>
                </div>
              </>
            ) : amount && goldPrice ? (
              <p className="text-muted-foreground">
                {calculateDisplayValue()}
              </p>
            ) : (
              <p className="text-muted-foreground/50">Enter amount to see quote</p>
            )}
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Button 
            variant="outline"
            className="py-4 text-base font-semibold"
            onClick={() => setAmount(getQuickAmount(0.25))}
          >
            25%
          </Button>
          <Button 
            variant="outline"
            className="py-4 text-base font-semibold"
            onClick={() => setAmount(getQuickAmount(0.5))}
          >
            50%
          </Button>
          <Button 
            variant="outline"
            className="py-4 text-base font-semibold"
            onClick={() => setAmount(getQuickAmount(1))}
          >
            Max
          </Button>
        </div>
      </main>

      {/* Sell Button - Fixed at bottom above navigation */}
      <div className="flex-shrink-0 px-4 py-4 pb-24 bg-background">
        <Button 
          className="w-full h-12 font-bold text-lg rounded-xl disabled:opacity-50"
          disabled={!amount || parseFloat(amount) <= 0 || !quote || quote.grams > goldBalance || sellLoading}
          onClick={handleSellWithMoonPay}
        >
          {sellLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 size={20} className="animate-spin" />
              Initiating Sale...
            </div>
          ) : quote && quote.grams > goldBalance ? (
            "Insufficient Balance"
          ) : (
            "Sell with MoonPay"
          )}
        </Button>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default SellGold;