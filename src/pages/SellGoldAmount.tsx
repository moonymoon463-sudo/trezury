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
  const [amount, setAmount] = useState("1.0");
  const [selectedUnit, setSelectedUnit] = useState("GRAMS");

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

  const calculateUsdValue = (grams: string) => {
    if (!goldPrice) return "0.00";
    const gramAmount = parseFloat(grams) || 0;
    const usd = quoteEngineService.calculateGramsToUsd(gramAmount, goldPrice.usd_per_gram);
    return usd.toFixed(2);
  };

  const calculateGramsValue = (usd: string) => {
    if (!goldPrice) return "0.000";
    const usdAmount = parseFloat(usd) || 0;
    const grams = quoteEngineService.calculateUsdToGrams(usdAmount, goldPrice.usd_per_gram);
    return grams.toFixed(3);
  };

  // Generate quote when amount changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      const numericAmount = parseFloat(amount);
      if (numericAmount > 0 && goldPrice) {
        const request = selectedUnit === "GRAMS"
          ? {
              side: 'sell' as const,
              inputAsset: 'GOLD' as const,
              outputAsset: 'USDC' as const,
              grams: numericAmount
            }
          : selectedUnit === "USD"
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
              grams: numericAmount // Treat tokens as grams for now
            };
        
        generateQuote(request);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [amount, selectedUnit, goldPrice, generateQuote]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/sell-gold")}
            className="text-foreground hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Sell {asset}</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8">
        {/* Gold Balance */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted-foreground">Available Balance</p>
          {balanceLoading ? (
            <div className="animate-pulse">
              <div className="h-8 w-32 bg-muted rounded mx-auto"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-foreground">
                {goldBalance.toFixed(3)} {asset}
              </p>
              <p className="text-lg text-muted-foreground">
                ≈ ${goldBalanceValue.toFixed(2)}
              </p>
            </>
          )}
        </div>

        {/* Unit Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-full bg-muted p-1">
            <button 
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                selectedUnit === "USD" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground"
              }`}
              onClick={() => setSelectedUnit("USD")}
            >
              USD
            </button>
            <button 
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                selectedUnit === "Tokens" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground"
              }`}
              onClick={() => setSelectedUnit("Tokens")}
            >
              Tokens
            </button>
            <button 
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
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
        <div className="text-center mb-8">
          <div className="relative">
            {selectedUnit === "USD" && (
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-foreground pointer-events-none">
                $
              </span>
            )}
            <input 
              className="w-full text-center text-6xl font-bold text-foreground bg-transparent border-none focus:ring-0 p-0 outline-none placeholder-muted-foreground"
              placeholder={selectedUnit === "USD" ? "0.00" : "0"}
              type="text"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
            />
          </div>
          
          {/* Real-time conversion with loading state */}
          <div className="mt-4 min-h-[2rem]">
            {quoteLoading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                <span>Calculating...</span>
              </div>
            ) : quote ? (
              <>
                <p className="text-muted-foreground mb-2">
                  {selectedUnit === "GRAMS"
                    ? `You will receive $${quote.outputAmount.toFixed(2)}`
                    : selectedUnit === "USD" 
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
            ) : goldPrice ? (
              <p className="text-muted-foreground">
                {selectedUnit === "GRAMS"
                  ? `≈ $${calculateUsdValue(amount)}`
                  : selectedUnit === "USD"
                  ? `≈ ${calculateGramsValue(amount)} grams`
                  : `≈ $${calculateUsdValue(amount)}`
                }
              </p>
            ) : (
              <p className="text-muted-foreground">Loading price...</p>
            )}
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-3 gap-4">
          <Button 
            variant="outline"
            className="py-6 text-lg font-semibold"
            onClick={() => setAmount((goldBalance * 0.25).toFixed(3))}
          >
            25%
          </Button>
          <Button 
            variant="outline"
            className="py-6 text-lg font-semibold"
            onClick={() => setAmount((goldBalance * 0.5).toFixed(3))}
          >
            50%
          </Button>
          <Button 
            variant="outline"
            className="py-6 text-lg font-semibold"
            onClick={() => setAmount(goldBalance.toFixed(3))}
          >
            Max
          </Button>
        </div>
      </main>

      {/* Continue Button */}
      <div className="px-4 py-6">
        <Button 
          className="w-full h-14 font-bold text-lg rounded-xl"
          disabled={!amount || parseFloat(amount) <= 0 || !quote || quote.grams > goldBalance}
          onClick={() => navigate("/sell-gold/confirmation", { state: { quote, asset } })}
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