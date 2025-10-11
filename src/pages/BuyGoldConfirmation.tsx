import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Clock, TrendingUp, Loader2 } from "lucide-react";
import { Quote } from "@/services/quoteEngine";
import { useToast } from "@/hooks/use-toast";
import { useTransactionExecution } from "@/hooks/useTransactionExecution";
import AurumLogo from "@/components/AurumLogo";
import { GaslessSwapToggle } from "@/components/GaslessSwapToggle";

const BuyGoldConfirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { executeTransaction, loading: executionLoading } = useTransactionExecution();
  const [isExecuting, setIsExecuting] = useState(false);
  const [gaslessEnabled, setGaslessEnabled] = useState(false);
  
  const quote = location.state?.quote as Quote;

  const handleCopyQuoteId = () => {
    if (quote?.id) {
      navigator.clipboard.writeText(quote.id);
      toast({
        title: "Copied!",
        description: "Quote ID copied to clipboard",
      });
    }
  };

  const timeRemaining = quote ? Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000)) : 0;

  const handleExecuteTransaction = async () => {
    if (!quote) return;

    setIsExecuting(true);
    try {
      const result = await executeTransaction(quote.id);
      
      if (result.success) {
        toast({
          title: "Purchase Successful!",
          description: "Your gold purchase has been completed.",
        });
        navigate("/transactions/success", { 
          state: { 
            transaction: result,
            type: 'buy'
          } 
        });
      } else {
        toast({
          title: "Purchase Failed",
          description: result.error || "Transaction could not be completed.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Purchase Failed",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  if (!quote) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-4">No Quote Found</h2>
            <p className="text-muted-foreground mb-6">Please return to the amount page to generate a new quote.</p>
            <Button 
              onClick={() => navigate("/buy-gold/amount")}
              className="bg-primary text-black hover:bg-primary/90"
            >
              Back to Amount
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/buy-gold/amount")}
            className="text-white hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex-1 flex justify-center pr-6">
            <AurumLogo compact />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8">
        {/* Quote Expiration Warning */}
        {timeRemaining > 0 && (
          <div className="bg-card border border-primary/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock size={16} />
              <span className="text-sm">Quote expires in {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
        )}

        {/* Quote Summary */}
        <div className="bg-card rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
              <TrendingUp size={20} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-white">Purchase Summary</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Gold Amount</span>
              <span className="text-white font-semibold">{quote.grams.toFixed(3)} grams</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Gold Price</span>
              <span className="text-white font-semibold">${quote.unitPriceUsd.toFixed(2)}/oz</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-white font-semibold">${(quote.inputAmount - quote.feeUsd).toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Fee ({(quote.feeBps / 100).toFixed(1)}%)</span>
              <span className="text-white font-semibold">${quote.feeUsd.toFixed(2)}</span>
            </div>

            <div className="border-t border-gray-600 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">Total</span>
                <span className="text-white font-bold text-xl">${quote.inputAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Minimum Received</span>
              <span className="text-gray-400">{quote.minimumReceived.toFixed(3)} grams</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Quote ID</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs font-mono">{quote.id.slice(0, 8)}...</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyQuoteId}
                  className="h-6 w-6 text-gray-400 hover:text-white"
                >
                  <Copy size={12} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Gasless Swap Toggle */}
        <GaslessSwapToggle 
          enabled={gaslessEnabled}
          onToggle={setGaslessEnabled}
          estimatedFee={gaslessEnabled ? "~0.5%" : undefined}
          estimatedFeeUSD={gaslessEnabled ? `~$${(quote.outputAmount * 0.005).toFixed(2)}` : undefined}
        />

        {/* Risk Disclosure */}
        <div className="bg-card rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            Prices are subject to market fluctuations. The actual amount received may vary slightly due to slippage protection.
            {gaslessEnabled && " Gasless mode deducts fees from output tokens."}
          </p>
        </div>
      </main>

      {/* Confirm Button */}
      <div className="px-4 py-6">
        <Button 
          className={`w-full h-14 font-bold text-lg rounded-xl ${
            timeRemaining === 0 || isExecuting || executionLoading
              ? 'bg-gray-600 text-gray-400' 
              : 'bg-primary text-black hover:bg-primary/90'
          }`}
          disabled={timeRemaining === 0 || isExecuting || executionLoading}
          onClick={handleExecuteTransaction}
        >
          {isExecuting || executionLoading ? (
            <>
              <Loader2 size={20} className="animate-spin mr-2" />
              Processing...
            </>
          ) : timeRemaining === 0 ? (
            "Quote Expired"
          ) : (
            "Confirm Purchase"
          )}
        </Button>
      </div>
    </div>
  );
};

export default BuyGoldConfirmation;