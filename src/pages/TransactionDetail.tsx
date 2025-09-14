import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Copy, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { Transaction } from "@/services/transactionService";
import { useToast } from "@/hooks/use-toast";

const TransactionDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { getTransaction } = useTransactions();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchTransaction = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const data = await getTransaction(id);
        setTransaction(data);
      } catch (error) {
        console.error('Failed to fetch transaction:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [id, getTransaction]);

  const handleCopyId = () => {
    if (transaction?.id) {
      navigator.clipboard.writeText(transaction.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Transaction ID copied to clipboard",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="p-4">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/transactions")}
            >
              <ArrowLeft size={24} />
            </Button>
            <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Transaction Details</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading transaction details...</p>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="p-4">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/transactions")}
            >
              <ArrowLeft size={24} />
            </Button>
            <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Transaction Details</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Transaction Not Found</h2>
            <p className="text-muted-foreground mb-6">Unable to load transaction details.</p>
            <Button onClick={() => navigate("/transactions")}>
              Back to Transactions
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isBuy = transaction.type === 'buy';
  const formatAmount = (quantity: number) => `${isBuy ? '+' : '-'}${quantity.toFixed(3)} g`;
  const formatValue = () => {
    if (transaction.unit_price_usd) {
      const value = (transaction.quantity * transaction.unit_price_usd / 31.1035);
      return `$${value.toFixed(2)}`;
    }
    return 'N/A';
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/transactions")}
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-6">Transaction Details</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8">
        {/* Status Section */}
        <div className="mb-8 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            transaction.status === 'completed' ? 'bg-primary' : 'bg-muted'
          }`}>
            {isBuy ? (
              <TrendingDown size={32} className="text-primary-foreground" />
            ) : (
              <TrendingUp size={32} className="text-primary-foreground" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2 capitalize">
            {transaction.type} {transaction.asset}
          </h2>
          <p className={`text-lg font-semibold capitalize ${
            transaction.status === 'completed' ? 'text-primary' : 'text-muted-foreground'
          }`}>
            {transaction.status}
          </p>
        </div>

        {/* Amount Section */}
        <div className="bg-card border border-border p-6 rounded-xl mb-6">
          <div className="text-center">
            <p className="text-muted-foreground text-sm mb-2">Amount</p>
            <p className="text-3xl font-bold text-foreground mb-1">{formatAmount(transaction.quantity)}</p>
            <p className="text-xl text-muted-foreground">{formatValue()}</p>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="bg-card border border-border p-6 rounded-xl mb-6">
          <h3 className="text-foreground text-lg font-semibold mb-4">Transaction Details</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Transaction ID</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground text-sm font-mono">
                  {transaction.id.slice(0, 8)}...
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyId}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </Button>
              </div>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date & Time</span>
              <span className="text-foreground">{new Date(transaction.created_at).toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Asset</span>
              <span className="text-foreground">{transaction.asset}</span>
            </div>
            
            {transaction.unit_price_usd && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit Price</span>
                <span className="text-foreground">${transaction.unit_price_usd.toFixed(2)}/oz</span>
              </div>
            )}
            
            {transaction.fee_usd && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span className="text-foreground">${transaction.fee_usd.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
          <div className="bg-card border border-border p-6 rounded-xl">
            <h3 className="text-foreground text-lg font-semibold mb-4">Additional Information</h3>
            <div className="space-y-2">
              {Object.entries(transaction.metadata).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-foreground text-sm">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TransactionDetail;