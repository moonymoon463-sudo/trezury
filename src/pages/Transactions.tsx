import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, RefreshCw, DollarSign } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useTransactions } from "@/hooks/useTransactions";
import AurumLogo from "@/components/AurumLogo";

const Transactions = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All");
  const { transactions, loading, error } = useTransactions();

  const filters = ["All", "Buy", "Sell"];

  const filteredTransactions = transactions.filter(tx => {
    if (activeFilter === "All") return true;
    return tx.type.toLowerCase() === activeFilter.toLowerCase();
  });

  const getTransactionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'buy':
        return { icon: ArrowDownLeft, color: "text-primary" };
      case 'sell':
        return { icon: ArrowUpRight, color: "text-destructive" };
      default:
        return { icon: RefreshCw, color: "text-muted-foreground" };
    }
  };

  const formatTransactionAmount = (tx: any) => {
    const sign = tx.type === 'buy' ? '+' : '-';
    return `${sign}${tx.quantity.toFixed(3)} g`;
  };

  const formatTransactionValue = (tx: any) => {
    const amount = tx.unit_price_usd ? (tx.quantity * tx.unit_price_usd / 31.1035).toFixed(2) : '0.00';
    return `$${amount}`;
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    } else if (diffInHours < 168) {
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleTransactionClick = (transactionId: string) => {
    navigate(`/transaction-detail/${transactionId}`);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="px-4 py-3 bg-background border-b border-border/5">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="h-10 w-10"
          >
            <ArrowLeft size={20} />
          </Button>
          <AurumLogo compact size="header" />
          <div className="w-10"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 pt-4 pb-24">
        <div className="max-w-md mx-auto space-y-6">
          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                  activeFilter === filter
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Transactions List */}
          <div>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading transactions...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-destructive">Error: {error}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((transaction) => {
                  const { icon: Icon, color } = getTransactionIcon(transaction.type);
                  
                  return (
                    <div
                      key={transaction.id}
                      onClick={() => handleTransactionClick(transaction.id)}
                      className="bg-card border border-border p-4 rounded-xl cursor-pointer hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                          <Icon size={20} className={color} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-foreground font-medium capitalize">{transaction.type}</p>
                            <p className="text-foreground font-semibold">{formatTransactionAmount(transaction)}</p>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <p className="text-muted-foreground text-sm">{formatTimestamp(transaction.created_at)}</p>
                            <p className="text-muted-foreground text-sm">{formatTransactionValue(transaction)}</p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            transaction.status === "completed"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {!loading && !error && filteredTransactions.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No transactions found</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Transactions;