import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { useState } from "react";

const TransactionDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [copied, setCopied] = useState(false);

  // Mock transaction data - in real app this would come from API
  const transaction = {
    id: id,
    type: "Buy Gold",
    status: "Completed",
    amount: "+0.12345 oz",
    value: "$330.56",
    fee: "$2.50",
    timestamp: "Dec 15, 2024 at 2:34 PM",
    txHash: "0x1234567890abcdef1234567890abcdef12345678",
    confirmations: 12,
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(transaction.txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-[#1C1C1E]">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/transactions")}
            className="text-white hover:bg-gray-800"
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold text-white flex-1 text-center pr-6">Transaction Details</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4">
        {/* Status Section */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{transaction.type}</h2>
          <p className="text-green-400 text-lg font-semibold">{transaction.status}</p>
        </div>

        {/* Amount Section */}
        <div className="bg-[#2C2C2E] p-6 rounded-xl mb-6">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-2">Amount</p>
            <p className="text-3xl font-bold text-white mb-1">{transaction.amount}</p>
            <p className="text-xl text-gray-300">{transaction.value}</p>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="bg-[#2C2C2E] p-6 rounded-xl mb-6">
          <h3 className="text-white text-lg font-semibold mb-4">Transaction Details</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-400">Transaction ID</span>
              <span className="text-white">#{transaction.id}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Date & Time</span>
              <span className="text-white">{transaction.timestamp}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Fee</span>
              <span className="text-white">{transaction.fee}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Confirmations</span>
              <span className="text-white">{transaction.confirmations}/12</span>
            </div>
          </div>
        </div>

        {/* Transaction Hash */}
        <div className="bg-[#2C2C2E] p-6 rounded-xl">
          <h3 className="text-white text-lg font-semibold mb-4">Transaction Hash</h3>
          
          <div className="flex items-center gap-3">
            <code className="text-gray-300 text-sm font-mono bg-[#1C1C1E] p-3 rounded flex-1 break-all">
              {transaction.txHash}
            </code>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyHash}
              className="text-gray-400 hover:text-white hover:bg-gray-700"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TransactionDetail;