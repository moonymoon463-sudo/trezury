import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Copy, ArrowRightLeft, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SwapTransaction {
  tx_hash: string;
  transaction_id?: string;
  input_asset: string;
  output_asset: string;
  input_amount: number;
  output_amount: number;
  exchange_rate: number;
  fee_usd: number;
  executed_at: string;
}

const SwapSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const transaction = location.state?.transaction as SwapTransaction;

  const handleCopyTxHash = () => {
    if (transaction?.tx_hash) {
      navigator.clipboard.writeText(transaction.tx_hash);
      toast({
        title: "Copied!",
        description: "Transaction hash copied to clipboard",
      });
    }
  };

  const handleViewOnEtherscan = () => {
    if (transaction?.tx_hash) {
      window.open(`https://etherscan.io/tx/${transaction.tx_hash}`, '_blank');
    }
  };

  if (!transaction) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Transaction Not Found</h2>
            <p className="text-muted-foreground mb-6">Unable to load swap details.</p>
            <Button onClick={() => navigate("/")}>
              Back to Dashboard
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
        <div className="flex items-center justify-center">
          <h1 className="text-xl font-bold text-foreground">Swap Complete</h1>
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
            Swap Complete! 🎉
          </h2>
          <p className="text-muted-foreground mb-8">
            Your token swap has been successfully executed on-chain
          </p>
        </div>

        {/* Transaction Details */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10">
              <ArrowRightLeft size={20} className="text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Swap Details</h3>
          </div>
          
          <div className="space-y-4">
            {/* From → To */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="text-sm text-muted-foreground mb-1">From</div>
                  <div className="text-lg font-bold text-foreground">
                    {transaction.input_amount.toFixed(6)} {transaction.input_asset}
                  </div>
                </div>
                <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                <div className="text-right">
                  <div className="text-sm text-muted-foreground mb-1">To</div>
                  <div className="text-lg font-bold text-foreground">
                    {transaction.output_amount.toFixed(6)} {transaction.output_asset}
                  </div>
                </div>
              </div>
            </div>

            {/* Exchange Rate */}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Exchange Rate</span>
              <span className="text-foreground font-semibold">
                1 {transaction.output_asset} = ${transaction.exchange_rate.toFixed(2)}
              </span>
            </div>

            {/* Fee */}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Platform Fee</span>
              <span className="text-foreground font-semibold">${transaction.fee_usd.toFixed(2)}</span>
            </div>

            {/* Time */}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Time</span>
              <span className="text-foreground font-semibold">
                {new Date(transaction.executed_at).toLocaleString()}
              </span>
            </div>

            {/* Transaction Hash */}
            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground text-sm">Transaction Hash</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-mono">
                    {transaction.tx_hash.slice(0, 10)}...{transaction.tx_hash.slice(-8)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyTxHash}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  >
                    <Copy size={12} />
                  </Button>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewOnEtherscan}
                className="w-full"
              >
                <ExternalLink size={14} className="mr-2" />
                View on Etherscan
              </Button>
            </div>
          </div>
        </div>

        {/* Info Message */}
        <div className="bg-muted/30 rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground text-center">
            Your updated balances are now available in your wallet
          </p>
        </div>
      </main>

      {/* Action Buttons */}
      <div className="px-4 py-6 space-y-3">
        {transaction.transaction_id && (
          <Button 
            className="w-full h-14 font-bold text-lg rounded-xl"
            onClick={() => navigate(`/transaction-detail/${transaction.transaction_id}`)}
          >
            View Transaction Details
          </Button>
        )}
        
        <Button 
          className="w-full h-14 font-bold text-lg rounded-xl"
          onClick={() => navigate("/")}
        >
          View in Wallet
        </Button>
        
        <Button 
          variant="outline"
          className="w-full h-12 font-semibold rounded-xl"
          onClick={() => navigate("/transactions")}
        >
          View Transaction History
        </Button>

        <Button 
          variant="ghost"
          className="w-full h-12 font-semibold rounded-xl"
          onClick={() => navigate("/swap")}
        >
          Make Another Swap
        </Button>
      </div>
    </div>
  );
};

export default SwapSuccess;
