import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { useBuyQuote } from "@/hooks/useBuyQuote";
import { useTransactionLimits } from "@/hooks/useTransactionLimits";
import { quoteEngineService } from "@/services/quoteEngine";
import { buyGoldSchema } from "@/lib/validation/transactionSchemas";
import { toast } from "sonner";
import { MoonPayFrame } from "@/components/recurring/MoonPayFrame";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { secureWalletService } from "@/services/secureWalletService";

const BuyGoldAmount = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [currency, setCurrency] = useState<"USD" | "GRAMS">("USD");
  const [amount, setAmount] = useState("100");
  const [showMoonPayDialog, setShowMoonPayDialog] = useState(false);
  const [moonPayUrl, setMoonPayUrl] = useState('');
  
  const { price: goldPrice } = useGoldPrice();
  const { quote, loading: quoteLoading, generateQuote } = useBuyQuote();
  const { checkTransactionVelocity, checking: limitsChecking } = useTransactionLimits();
  
  // Get payment method from sessionStorage
  const paymentMethod = sessionStorage.getItem('selectedPaymentMethod') || 'usdc';
  
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
    const usdAmount = currency === 'USD' ? numericAmount : parseFloat(calculateUsdAmount(amount));

    // Validate input with Zod schema
    const validation = buyGoldSchema.safeParse({
      amountUSD: usdAmount,
      paymentMethod: paymentMethod === 'credit_card' ? 'card' : 'wallet',
    });

    if (!validation.success) {
      const error = validation.error.errors[0];
      toast.error(error.message);
      return;
    }

    // Check transaction limits
    const velocityCheck = await checkTransactionVelocity(usdAmount);
    if (!velocityCheck.allowed) {
      return; // Error toast already shown by the hook
    }

    // Handle card payment with MoonPay
    if (paymentMethod === 'credit_card') {
      if (!user) {
        toast.error('Please sign in to continue');
        return;
      }

      try {
        // Get wallet address
        const walletAddress = await secureWalletService.getWalletAddress(user.id);
        if (!walletAddress) {
          toast.error('Unable to retrieve wallet address');
          return;
        }

        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('Session expired. Please sign in again.');
          return;
        }

        // Call moonpay-proxy to get widget URL
        const { data, error } = await supabase.functions.invoke('moonpay-proxy', {
          body: {
            amount: usdAmount,
            currency: 'USD',
            walletAddress,
            userId: user.id,
            returnUrl: `${window.location.origin}/moonpay-callback`,
          },
        });

        if (error) {
          toast.error(error.message || 'Failed to initiate payment');
          return;
        }

        if (!data.success) {
          toast.error(data.error || 'Payment initiation failed');
          return;
        }

        // Open MoonPay in embedded dialog
        setMoonPayUrl(data.widgetUrl);
        setShowMoonPayDialog(true);
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
            className="text-white hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">Buy Gold</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pb-4">
        <div className="max-w-lg mx-auto space-y-6 md:max-w-2xl">
          {/* USD Balance */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">USD Balance</p>
            <p className="text-3xl font-bold text-white">
            ${usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>

          {/* Currency Toggle */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-full bg-card p-1">
              <button 
                className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                  currency === "USD" 
                    ? "bg-primary text-black"
                    : "text-muted-foreground"
                }`}
                onClick={() => setCurrency("USD")}
              >
                USD
              </button>
              <button 
                className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                  currency === "GRAMS" 
                    ? "bg-primary text-black" 
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

        {/* Continue Button */}
        <div className="pt-4">
          <Button 
            className="w-full bg-primary text-black font-bold h-14 text-lg rounded-xl hover:bg-primary/90"
            disabled={!amount || parseFloat(amount) <= 0 || (paymentMethod === 'usdc' && !quote)}
            onClick={handleContinue}
          >
            {paymentMethod === 'credit_card' ? 'Pay with Card' : 'Continue'}
          </Button>
        </div>
        </div>
      </main>

      {/* MoonPay Embedded Dialog */}
      <MoonPayFrame
        url={moonPayUrl}
        open={showMoonPayDialog}
        onOpenChange={setShowMoonPayDialog}
        onComplete={() => {
          setShowMoonPayDialog(false);
          navigate('/transaction-success');
        }}
        onError={(error) => {
          toast.error(error);
        }}
      />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default BuyGoldAmount;