import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { useBuyQuote } from "@/hooks/useBuyQuote";
import { useMoonPayBuy } from "@/hooks/useMoonPayBuy";
import { quoteEngineService } from "@/services/quoteEngine";
import { toast } from "sonner";

const BuyGoldAmount = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currency, setCurrency] = useState<"USD" | "GRAMS">("USD");
  const [amount, setAmount] = useState("100");
  
  const { price: goldPrice } = useGoldPrice();
  const { quote, loading: quoteLoading, generateQuote } = useBuyQuote();
  const { initiateBuy, loading: moonPayLoading } = useMoonPayBuy();
  
  // Get payment method from location state (passed from BuyGold page)
  const paymentMethod = location.state?.paymentMethod || 'usdc';
  
  // Mock USD balance - would come from wallet service
  const usdBalance = 10000.00;
  
  const goldPricePerGram = goldPrice ? goldPrice.usd_per_gram : 0;
  
  const calculateGoldAmount = (usdAmount: string) => {
    if (!goldPrice) return "0.000";
    const usd = parseFloat(usdAmount) || 0;
    const grams = quoteEngineService.calculateUsdToGrams(usd, goldPrice.usd_per_gram);
    return grams.toFixed(3);
  };
  
  const calculateUsdAmount = (grams: string) => {
    if (!goldPrice) return "0.00";
    const gramAmount = parseFloat(grams) || 0;
    const usd = quoteEngineService.calculateGramsToUsd(gramAmount, goldPrice.usd_per_gram);
    return usd.toFixed(2);
  };

  const handleAmountChange = (value: string) => {
    // Remove any non-numeric characters except decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');
    setAmount(cleanValue);
  };

  const handleQuickAmount = (quickAmount: string) => {
    setAmount(quickAmount);
  };

  // Generate quote when amount changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      const numericAmount = parseFloat(amount);
      if (numericAmount > 0 && goldPrice) {
        const request = currency === "USD" 
          ? {
              side: 'buy' as const,
              inputAsset: 'USDC' as const,
              outputAsset: 'GOLD' as const,
              inputAmount: numericAmount
            }
          : {
              side: 'buy' as const,
              inputAsset: 'USDC' as const,
              outputAsset: 'GOLD' as const,
              grams: numericAmount
            };
        
        generateQuote(request);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [amount, currency, goldPrice, generateQuote]);

  const handleContinue = async () => {
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // Handle card payment with MoonPay
    if (paymentMethod === 'credit_card') {
      try {
        const usdAmount = currency === 'USD' ? numericAmount : parseFloat(calculateUsdAmount(amount));
        
        // Additional validation for card payments
        if (usdAmount < 10) {
          toast.error('Minimum purchase amount is $10 for card payments');
          return;
        }

        if (usdAmount > 10000) {
          toast.error('Maximum purchase amount is $10,000. Please contact support for larger amounts.');
          return;
        }

        const result = await initiateBuy({
          amount: usdAmount,
          currency: 'USD'
        });

        if (result.success && result.redirectUrl) {
          // Show success message before redirect
          toast.success('Redirecting to secure payment...', { duration: 3000 });
          
          // Small delay to allow user to see the message
          setTimeout(() => {
            window.location.href = result.redirectUrl!;
          }, 1500);
        } else {
          // Error handling is already done in the hook
          console.error('MoonPay initiation failed:', result.error);
        }
      } catch (error) {
        console.error('MoonPay initiation error:', error);
        toast.error('Failed to initiate payment. Please try again.');
      }
      return;
    }

    // Handle USDC payment flow
    if (!quote) {
      toast.error('Please wait for quote calculation');
      return;
    }

    // Check if user has sufficient USDC balance for USDC payments
    if (paymentMethod === 'usdc') {
      if (quote.inputAmount > usdBalance) {
        toast.error(`You need $${quote.inputAmount.toFixed(2)} USDC but only have $${usdBalance.toFixed(2)}`);
        return;
      }
    }

    // Store the amount and currency for the next step
    sessionStorage.setItem('buyGoldAmount', amount);
    sessionStorage.setItem('buyGoldCurrency', currency);
    
    navigate('/buy-gold/confirmation', { state: { quote } });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/buy-gold")}
            className="text-foreground hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Buy Gold</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8">
        {/* USD Balance */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted-foreground">USD Balance</p>
          <p className="text-3xl font-bold text-foreground">
            ${usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Currency Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-full bg-muted p-1">
            <button 
              className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                currency === "USD" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground"
              }`}
              onClick={() => setCurrency("USD")}
            >
              USD
            </button>
            <button 
              className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                currency === "GRAMS" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground"
              }`}
              onClick={() => setCurrency("GRAMS")}
            >
              GRAMS
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div className="text-center mb-8">
          <div className="relative">
            {currency === "USD" && (
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-foreground pointer-events-none">
                $
              </span>
            )}
            <input
              aria-label={`Amount in ${currency}`}
              className="w-full border-0 bg-transparent text-center text-6xl font-bold text-foreground focus:ring-0 focus:outline-none placeholder-muted-foreground"
              type="text"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
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
                  {currency === "USD" 
                    ? `You will receive ${quote.grams.toFixed(3)} grams of gold`
                    : `This will cost $${quote.inputAmount.toFixed(2)}`
                  }
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Fee: ${quote.feeUsd.toFixed(2)} ({(quote.feeBps / 100).toFixed(1)}%)</p>
                  <p>Gold price: ${quote.unitPriceUsd.toFixed(2)}/oz</p>
                </div>
              </>
            ) : goldPrice ? (
              <p className="text-muted-foreground">
                {currency === "USD" 
                  ? `You will receive ${calculateGoldAmount(amount)} grams of gold`
                  : `This will cost $${calculateUsdAmount(amount)}`
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
            onClick={() => handleQuickAmount(currency === "USD" ? "100" : "1.0")}
          >
            {currency === "USD" ? "$100" : "1.0g"}
          </Button>
          <Button 
            variant="outline"
            className="py-6 text-lg font-semibold"
            onClick={() => handleQuickAmount(currency === "USD" ? "250" : "2.5")}
          >
            {currency === "USD" ? "$250" : "2.5g"}
          </Button>
          <Button 
            variant="outline"
            className="py-6 text-lg font-semibold"
            onClick={() => handleQuickAmount(currency === "USD" ? "500" : "5.0")}
          >
            {currency === "USD" ? "$500" : "5.0g"}
          </Button>
        </div>
      </main>

      {/* Continue Button */}
      <div className="px-4 py-6">
        <Button 
          className="w-full h-14 font-bold text-lg rounded-xl"
          disabled={!amount || parseFloat(amount) <= 0 || (paymentMethod === 'usdc' && !quote) || moonPayLoading}
          onClick={handleContinue}
        >
          {moonPayLoading ? 'Processing...' : paymentMethod === 'credit_card' ? 'Pay with Card' : 'Continue'}
        </Button>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default BuyGoldAmount;