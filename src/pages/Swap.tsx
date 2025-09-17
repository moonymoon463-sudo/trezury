import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronDown, ArrowUpDown, Edit } from "lucide-react";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useBuyQuote } from "@/hooks/useBuyQuote";
import { useTransactionExecution } from "@/hooks/useTransactionExecution";
import { useToast } from "@/hooks/use-toast";
import { swapFeeService } from "@/services/swapFeeService";
import AurumLogo from "@/components/AurumLogo";

const Swap = () => {
  const navigate = useNavigate();
  const { balances, getBalance } = useWalletBalance();
  const { generateQuote, quote, loading: quoteLoading } = useBuyQuote();
  const { executeTransaction, loading: transactionLoading } = useTransactionExecution();
  const { toast } = useToast();
  
  const [fromAsset, setFromAsset] = useState<'USDC' | 'GOLD'>('USDC');
  const [toAsset, setToAsset] = useState<'USDC' | 'GOLD'>('GOLD');
  const [fromAmount, setFromAmount] = useState('');
  
  const fromBalance = getBalance(fromAsset);
  const toBalance = getBalance(toAsset);
  
  const getNetworkForAsset = (asset: 'USDC' | 'GOLD') => {
    return 'Ethereum'; // Both assets on Ethereum now
  };
  
  const handleSwapTokens = () => {
    const tempAsset = fromAsset;
    setFromAsset(toAsset);
    setToAsset(tempAsset);
    setFromAmount('');
  };
  
  const handlePreviewSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid amount to swap"
      });
      return;
    }
    
    if (parseFloat(fromAmount) > fromBalance) {
      toast({
        variant: "destructive", 
        title: "Insufficient Balance",
        description: `You don't have enough ${fromAsset}`
      });
      return;
    }
    
    try {
      await generateQuote({
        side: fromAsset === 'USDC' ? 'buy' : 'sell',
        inputAsset: fromAsset,
        outputAsset: toAsset,
        inputAmount: fromAsset === 'USDC' ? parseFloat(fromAmount) : undefined,
        grams: fromAsset === 'GOLD' ? parseFloat(fromAmount) : undefined
      });
      
      toast({
        title: "Quote Generated",
        description: "Swap quote ready for execution"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Quote Failed", 
        description: "Failed to generate swap quote"
      });
    }
  };

  const handleExecuteSwap = async () => {
    if (!quote) {
      toast({
        variant: "destructive",
        title: "No Quote",
        description: "Please generate a quote first"
      });
      return;
    }

    try {
      // Calculate swap fees in tokens
      const swapFee = swapFeeService.calculateSwapFee(
        quote.outputAmount, 
        toAsset, 
        fromAsset
      );

      // Execute the transaction with fee information
      const result = await executeTransaction(quote.id, 'wallet');
      
      if (result.success) {
        // Record fee collection
        await swapFeeService.recordSwapFeeCollection(
          'user-id', // Would get from auth context
          result.transaction_id || '',
          swapFee
        );

        toast({
          title: "Swap Successful",
          description: `Swapped ${fromAmount} ${fromAsset} for ${swapFee.remainingAmount.toFixed(6)} ${toAsset}`
        });
        
        // Navigate to success page or refresh balances
        setFromAmount('');
      } else {
        toast({
          variant: "destructive",
          title: "Swap Failed",
          description: result.error || "Transaction failed"
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Swap Error",
        description: "Failed to execute swap"
      });
    }
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
          <div className="flex-1 flex justify-center pr-6">
            <AurumLogo compact />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4">
        {/* Swap Interface */}
        <div className="relative flex flex-col gap-2 my-8">
          {/* From Section */}
          <div className="bg-[#2C2C2E] p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">From</span>
              <span className="text-sm text-gray-400">Balance: {fromBalance.toFixed(fromAsset === 'GOLD' ? 6 : 2)} {fromAsset}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className={`w-10 h-10 ${fromAsset === 'GOLD' ? 'bg-yellow-600' : 'bg-blue-600'} rounded-full flex items-center justify-center`}>
                  <span className="text-white text-xs font-bold">{fromAsset}</span>
                </div>
                <div>
                  <span className="text-white text-lg font-bold">{fromAsset}</span>
                  <div className="text-xs text-gray-400">{getNetworkForAsset(fromAsset)}</div>
                </div>
                <ChevronDown className="text-gray-400" size={20} />
              </div>
              <Input
                className="bg-transparent border-none text-white text-right text-2xl font-bold placeholder:text-gray-500 focus:ring-0"
                placeholder="0.00"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Swap Button */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleSwapTokens}
              className="bg-[#48484A] rounded-full p-2 text-white border-4 border-[#2C2C2E] hover:bg-[#48484A]/80"
            >
              <ArrowUpDown size={20} />
            </Button>
          </div>

          {/* To Section */}
          <div className="bg-[#2C2C2E] p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">To</span>
              <span className="text-sm text-gray-400">Balance: {toBalance.toFixed(toAsset === 'GOLD' ? 6 : 2)} {toAsset}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className={`w-10 h-10 ${toAsset === 'GOLD' ? 'bg-yellow-600' : 'bg-blue-600'} rounded-full flex items-center justify-center`}>
                  <span className="text-white text-xs font-bold">{toAsset}</span>
                </div>
                <div>
                  <span className="text-white text-lg font-bold">{toAsset}</span>
                  <div className="text-xs text-gray-400">{getNetworkForAsset(toAsset)}</div>
                </div>
                <ChevronDown className="text-gray-400" size={20} />
              </div>
              <Input
                className="bg-transparent border-none text-white text-right text-2xl font-bold placeholder:text-gray-500 focus:ring-0"
                placeholder="0.00"
                value={quote ? (toAsset === 'GOLD' ? quote.grams.toFixed(6) : quote.outputAmount.toFixed(2)) : ''}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Trading Details */}
        <div className="space-y-3 mb-8">
          <div className="flex justify-between items-center bg-[#2C2C2E] p-4 rounded-xl">
            <span className="text-white">Slippage Tolerance</span>
            <div className="flex items-center gap-2">
              <span className="text-white">0.5%</span>
              <Edit className="text-gray-400" size={16} />
            </div>
          </div>

          <div className="flex justify-between items-center bg-[#2C2C2E] p-4 rounded-xl">
            <span className="text-white">Transaction Fees</span>
            <span className="text-white">Paid in {toAsset} tokens</span>
          </div>

          <div className="flex justify-between items-center bg-[#2C2C2E] p-4 rounded-xl">
            <span className="text-white">Route</span>
            <span className="text-white">{fromAsset} → {toAsset}</span>
          </div>
          
          {quote && (
            <>
              <div className="flex justify-between items-center bg-[#2C2C2E] p-4 rounded-xl">
                <span className="text-white">Exchange Rate</span>
                <span className="text-white">${quote.unitPriceUsd}/gram</span>
              </div>
              
              <div className="flex justify-between items-center bg-[#2C2C2E] p-4 rounded-xl">
                <span className="text-white">Platform Fee (1%)</span>
                <span className="text-white">
                  {swapFeeService.calculateSwapFee(quote.outputAmount, toAsset, fromAsset).feeAmount.toFixed(6)} {toAsset}
                </span>
              </div>
              
              <div className="flex justify-between items-center bg-[#2C2C2E] p-4 rounded-xl">
                <span className="text-white">You'll receive</span>
                <span className="text-white font-bold">
                  {swapFeeService.calculateSwapFee(quote.outputAmount, toAsset, fromAsset).remainingAmount.toFixed(6)} {toAsset}
                </span>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Bottom Button */}
      <div className="p-6">
        <Button 
          onClick={quote ? handleExecuteSwap : handlePreviewSwap}
          disabled={quoteLoading || transactionLoading || !fromAmount}
          className="w-full h-14 bg-[#f9b006] text-black font-bold text-lg rounded-xl hover:bg-[#f9b006]/90 disabled:opacity-50"
        >
          {quoteLoading ? "Generating Quote..." : transactionLoading ? "Executing..." : quote ? "Execute Swap" : "Preview Swap"}
        </Button>
      </div>
    </div>
  );
};

export default Swap;