import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Copy, TrendingUp, TrendingDown } from "lucide-react";
import { TransactionResult } from "@/services/transactionService";
import { useToast } from "@/hooks/use-toast";

const TransactionSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const transactionData = location.state?.transaction as TransactionResult;
  const transactionType = location.state?.type as 'buy' | 'sell';
  const asset = location.state?.asset || 'GOLD';

  const handleCopyTransactionId = () => {
    if (transactionData?.transaction_id) {
      navigator.clipboard.writeText(transactionData.transaction_id);
      toast({
        title: "Copied!",
        description: "Transaction ID copied to clipboard",
      });
    }
  };

  if (!transactionData || !transactionData.success) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Transaction Not Found</h2>
            <p className="text-muted-foreground mb-6">Unable to load transaction details.</p>
            <Button onClick={() => navigate("/")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const quote = transactionData.quote;
  const isBuy = transactionType === 'buy';

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center justify-center">
          <h1 className="text-xl font-bold text-foreground">Transaction Complete</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="bg-primary p-4 rounded-full mb-6 w-20 h-20 mx-auto flex items-center justify-center">
            <Check size={40} className="text-primary-foreground" />
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-3">
            {isBuy ? 'Purchase Complete!' : 'Sale Complete!'}
          </h2>
          <p className="text-muted-foreground mb-8">
            Your {isBuy ? 'gold purchase' : 'gold sale'} has been successfully processed.
          </p>
        </div>

        {/* Transaction Details */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isBuy ? 'bg-primary/10' : 'bg-destructive/10'
            }`}>
              {isBuy ? (
                <TrendingUp size={20} className="text-primary" />
              ) : (
                <TrendingDown size={20} className="text-destructive" />
              )}
            </div>
            <h3 className="text-xl font-bold text-foreground">Transaction Details</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Type</span>
              <span className="text-foreground font-semibold capitalize">{transactionType}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Asset</span>
              <span className="text-foreground font-semibold">{asset}</span>
            </div>

            {quote && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="text-foreground font-semibold">{quote.grams.toFixed(3)} grams</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Gold Price</span>
                  <span className="text-foreground font-semibold">${quote.unit_price_usd.toFixed(2)}/oz</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="text-foreground font-semibold">${quote.fee_usd.toFixed(2)}</span>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-bold">
                      {isBuy ? 'Total Paid' : 'Total Received'}
                    </span>
                    <span className="text-foreground font-bold text-xl">
                      ${isBuy ? quote.input_amount.toFixed(2) : quote.output_amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Time</span>
              <span className="text-foreground font-semibold">
                {new Date(transactionData.executed_at!).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Transaction ID</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-mono">
                  {transactionData.transaction_id?.slice(0, 8)}...
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyTransactionId}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <Copy size={12} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Info Message */}
        <div className="bg-muted/30 rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground text-center">
            {isBuy 
              ? "Your gold has been added to your wallet and is available for trading."
              : "The proceeds from your sale will be reflected in your wallet balance."
            }
          </p>
        </div>
      </main>

      {/* Action Buttons */}
      <div className="px-4 py-6 space-y-3">
        <Button 
          className="w-full h-14 font-bold text-lg rounded-xl"
          onClick={() => navigate("/transactions")}
        >
          View Transaction History
        </Button>
        
        <Button 
          variant="outline"
          className="w-full h-12 font-semibold rounded-xl"
          onClick={() => navigate("/")}
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default TransactionSuccess;