import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Copy, Clock } from "lucide-react";
import { Quote } from "@/services/quoteEngine";
import { useToast } from "@/hooks/use-toast";

const BuyGoldConfirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
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

  if (!quote) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">No Quote Found</h2>
            <p className="text-muted-foreground mb-6">Please return to the amount page to generate a new quote.</p>
            <Button onClick={() => navigate("/buy-gold/amount")}>
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
            className="text-foreground hover:bg-accent"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Confirm Purchase</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8">
        {/* Quote Expiration Warning */}
        {timeRemaining > 0 && (
          <div className="bg-accent border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock size={16} />
              <span className="text-sm">Quote expires in {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
        )}

        {/* Quote Summary */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Purchase Summary</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Gold Amount</span>
              <span className="text-foreground font-semibold">{quote.grams.toFixed(3)} grams</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Gold Price</span>
              <span className="text-foreground font-semibold">${quote.unitPriceUsd.toFixed(2)}/oz</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground font-semibold">${(quote.inputAmount - quote.feeUsd).toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Fee ({(quote.feeBps / 100).toFixed(1)}%)</span>
              <span className="text-foreground font-semibold">${quote.feeUsd.toFixed(2)}</span>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-center">
                <span className="text-foreground font-bold">Total</span>
                <span className="text-foreground font-bold text-xl">${quote.inputAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Minimum Received</span>
              <span className="text-muted-foreground">{quote.minimumReceived.toFixed(3)} grams</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Quote ID</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-mono">{quote.id.slice(0, 8)}...</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyQuoteId}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <Copy size={12} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Disclosure */}
        <div className="bg-muted/30 rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            Prices are subject to market fluctuations. The actual amount received may vary slightly due to slippage protection.
          </p>
        </div>
      </main>

      {/* Confirm Button */}
      <div className="px-4 py-6">
        <Button 
          className="w-full h-14 font-bold text-lg rounded-xl"
          disabled={timeRemaining === 0}
          onClick={() => navigate("/buy-gold/success", { state: { quote } })}
        >
          {timeRemaining === 0 ? "Quote Expired" : "Confirm Purchase"}
        </Button>
      </div>
    </div>
  );
};

export default BuyGoldConfirmation;