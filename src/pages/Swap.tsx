import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronDown, ArrowUpDown, Edit } from "lucide-react";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useBuyQuote } from "@/hooks/useBuyQuote";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { swapService, SwapQuote } from "@/services/swapService";
import AurumLogo from "@/components/AurumLogo";

const Swap = () => {
  const navigate = useNavigate();
  const { balances, getBalance } = useWalletBalance();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [fromAsset, setFromAsset] = useState<'USDC' | 'XAUT'>('USDC');
  const [toAsset, setToAsset] = useState<'USDC' | 'XAUT'>('XAUT');
  const [fromAmount, setFromAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  
  const fromBalance = getBalance(fromAsset);
  const toBalance = getBalance(toAsset);
  
  const getNetworkForAsset = (asset: 'USDC' | 'XAUT') => {
    return 'Ethereum'; // Both assets on Ethereum mainnet
  };
  
  const handleSwapTokens = () => {
    const tempAsset = fromAsset;
    setFromAsset(toAsset);
    setToAsset(tempAsset);
    setFromAmount('');
  };
  
  const handlePreviewSwap = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to continue"
      });
      return;
    }

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

    // Validate asset pair
    if ((fromAsset === 'USDC' && toAsset !== 'XAUT') || (fromAsset === 'XAUT' && toAsset !== 'USDC')) {
      toast({
        variant: "destructive",
        title: "Invalid Swap Pair",
        description: "You can only swap between USDC and XAUT"
      });
      return;
    }
    
    try {
      setLoading(true);
      const newQuote = await swapService.generateSwapQuote(
        fromAsset,
        toAsset,
        parseFloat(fromAmount),
        user.id
      );
      
      setQuote(newQuote);
      
      toast({
        title: "Quote Generated",
        description: "Swap quote ready for execution"
      });
    } catch (error) {
      console.error('Quote generation error:', error);
      toast({
        variant: "destructive",
        title: "Quote Failed", 
        description: "Failed to generate swap quote"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSwap = async () => {
    if (!user || !quote) {
      toast({
        variant: "destructive",
        title: "Cannot Execute Swap",
        description: !user ? "Please sign in first" : "Please generate a quote first"
      });
      return;
    }

    // Check if quote is expired
    if (new Date() > new Date(quote.expiresAt)) {
      toast({
        variant: "destructive",
        title: "Quote Expired",
        description: "Please generate a new quote"
      });
      setQuote(null);
      return;
    }

    try {
      setLoading(true);
      
      // Execute the swap transaction
      const result = await swapService.executeSwap(quote.id, user.id);
      
      if (result.success) {
        toast({
          title: "Swap Successful",
          description: `Successfully swapped ${fromAmount} ${fromAsset} for ${toAsset}`
        });
        
        // Reset form
        setFromAmount('');
        setQuote(null);
        
        // Refresh balances (assuming useWalletBalance has a refresh method)
        if (typeof (window as any).location !== 'undefined') {
          window.location.reload(); // Simple refresh for now
        }
      } else {
        toast({
          variant: "destructive",
          title: "Swap Failed",
          description: result.error || "Transaction failed"
        });
      }
    } catch (error) {
      console.error('Swap execution error:', error);
      toast({
        variant: "destructive",
        title: "Swap Error",
        description: "Failed to execute swap"
      });
    } finally {
      setLoading(false);
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
              <span className="text-sm text-muted-foreground">Balance: {fromBalance.toFixed(fromAsset === 'XAUT' ? 6 : 2)} {fromAsset}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className={`w-10 h-10 ${fromAsset === 'XAUT' ? 'bg-yellow-600' : 'bg-blue-600'} rounded-full flex items-center justify-center`}>
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
              <span className="text-sm text-muted-foreground">Balance: {toBalance.toFixed(toAsset === 'XAUT' ? 6 : 2)} {toAsset}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className={`w-10 h-10 ${toAsset === 'XAUT' ? 'bg-yellow-600' : 'bg-blue-600'} rounded-full flex items-center justify-center`}>
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
                value={quote ? quote.outputAmount.toFixed(6) : ''}
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
              <div className="flex justify-between items-center bg-surface-secondary p-4 rounded-xl">
                <span className="text-foreground">Exchange Rate</span>
                <span className="text-foreground">${quote.exchangeRate.toFixed(2)}/{toAsset === 'XAUT' ? 'oz' : 'unit'}</span>
              </div>
              
              <div className="flex justify-between items-center bg-surface-secondary p-4 rounded-xl">
                <span className="text-foreground">Platform Fee (1.5%)</span>
                <span className="text-foreground">
                  {quote.fee.toFixed(6)} {fromAsset}
                </span>
              </div>
              
              <div className="flex justify-between items-center bg-surface-secondary p-4 rounded-xl">
                <span className="text-foreground">Minimum Received</span>
                <span className="text-foreground">
                  {quote.minimumReceived.toFixed(6)} {toAsset}
                </span>
              </div>

              <div className="flex justify-between items-center bg-surface-secondary p-4 rounded-xl">
                <span className="text-foreground">You'll receive</span>
                <span className="text-foreground font-bold">
                  ≈ {quote.outputAmount.toFixed(6)} {toAsset}
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
          disabled={loading || !fromAmount}
          className="w-full h-14 bg-primary text-primary-foreground font-bold text-lg rounded-xl hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (quote ? "Executing Swap..." : "Generating Quote...") : quote ? "Execute Swap" : "Preview Swap"}
        </Button>
      </div>
    </div>
  );
};

export default Swap;