import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, RefreshCw, DollarSign } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";

const Transactions = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All");

  const filters = ["All", "Buy", "Sell", "P2P", "Fees"];

  const transactions = [
    {
      id: 1,
      type: "Buy",
      icon: ArrowDownLeft,
      iconColor: "text-green-500",
      amount: "+0.12345 oz",
      value: "$330.56",
      status: "Completed",
      timestamp: "2 hours ago",
    },
    {
      id: 2,
      type: "Sell",
      icon: ArrowUpRight,
      iconColor: "text-red-500",
      amount: "-0.05000 oz",
      value: "$133.92",
      status: "Completed",
      timestamp: "1 day ago",
    },
    {
      id: 3,
      type: "P2P",
      icon: RefreshCw,
      iconColor: "text-blue-500",
      amount: "+0.03000 oz",
      value: "$80.35",
      status: "Pending",
      timestamp: "2 days ago",
    },
    {
      id: 4,
      type: "Fees",
      icon: DollarSign,
      iconColor: "text-orange-500",
      amount: "-$2.50",
      value: "Transaction Fee",
      status: "Completed",
      timestamp: "3 days ago",
    },
  ];

  const handleTransactionClick = (transactionId: number) => {
    navigate(`/transaction-detail/${transactionId}`);
  };

  return (
    <div className="flex flex-col h-screen bg-[#1C1C1E]">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/")}
            className="text-white hover:bg-gray-800"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">History</h1>
        </div>
      </header>

      {/* Filters */}
      <div className="px-4 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                activeFilter === filter
                  ? "bg-[#f9b006] text-black"
                  : "bg-[#2C2C2E] text-gray-400 hover:text-white"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      <main className="flex-1 px-4">
        <div className="space-y-3">
          {transactions.map((transaction) => {
            const Icon = transaction.icon;
            
            return (
              <div
                key={transaction.id}
                onClick={() => handleTransactionClick(transaction.id)}
                className="bg-[#2C2C2E] p-4 rounded-xl cursor-pointer hover:bg-[#3C3C3E] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#48484A] rounded-full flex items-center justify-center">
                    <Icon size={20} className={transaction.iconColor} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-white font-medium">{transaction.type}</p>
                      <p className="text-white font-semibold">{transaction.amount}</p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-gray-400 text-sm">{transaction.timestamp}</p>
                      <p className="text-gray-400 text-sm">{transaction.value}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      transaction.status === "Completed"
                        ? "bg-green-900/30 text-green-400"
                        : "bg-yellow-900/30 text-yellow-400"
                    }`}>
                      {transaction.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {transactions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">No transactions found</p>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Transactions;