import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ArrowUpDown, Edit, Wallet } from "lucide-react";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSecureWallet } from "@/hooks/useSecureWallet";
import { swapService, SwapQuote } from "@/services/swapService";
import AppLayout from "@/components/AppLayout";

const Swap = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { balances, getBalance, refreshBalances, walletAddress } = useWalletBalance();
  const { user } = useAuth();
  const { toast } = useToast();
  const { walletAddress: secureWalletAddress, getWalletAddress, loading: walletLoading } = useSecureWallet();
  
  const [fromAsset, setFromAsset] = useState<'USDC' | 'XAUT' | 'TRZRY'>('USDC');
  const [toAsset, setToAsset] = useState<'USDC' | 'XAUT' | 'TRZRY'>('XAUT');
  const [fromAmount, setFromAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);

  // Handle URL parameters and initialize wallet
  useEffect(() => {
    if (user && !secureWalletAddress) {
      getWalletAddress();
    }
    
    // Handle URL parameters for pre-selecting assets
    const toParam = searchParams.get('to');
    if (toParam && ['USDC', 'XAUT', 'TRZRY'].includes(toParam)) {
      setToAsset(toParam as 'USDC' | 'XAUT' | 'TRZRY');
      if (toParam === 'TRZRY') {
        setFromAsset('USDC'); // Default to USDC when buying TRZRY
      }
    }
  }, [user, secureWalletAddress, getWalletAddress, searchParams]);
  
  const fromBalance = getBalance(fromAsset);
  const toBalance = getBalance(toAsset);
  
  const getNetworkForAsset = (asset: 'USDC' | 'XAUT' | 'TRZRY') => {
    return 'Ethereum'; // All assets on Ethereum mainnet
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
      
      // Execute the REAL swap transaction
      console.log('🔄 Executing REAL on-chain swap...');
      const result = await swapService.executeSwap(quote.id, user.id);
      
      if (result.success) {
        console.log('🎉 REAL swap completed successfully!');
        
        // Enhanced success message with gas info
        let successDescription = `Successfully swapped ${fromAmount} ${fromAsset} for ${toAsset}`;
        if (result.gasFeePaidInTokens) {
          successDescription += ` (Gas paid from ${fromAsset}: ${result.gasFeeInTokens?.toFixed(6)})`;
        }
        if (result.hash) {
          successDescription += `. Tx: ${result.hash.slice(0, 10)}...`;
        }
        
        toast({
          title: "Swap Successful!",
          description: successDescription
        });
        
        // Reset form
        setFromAmount('');
        setQuote(null);
        
        // Refresh balances to show real on-chain data
        refreshBalances();
      } else {
        console.error('❌ REAL swap failed:', result.error);
        
        // Enhanced error messages
        let errorMessage = result.error || "Swap execution failed";
        if (errorMessage.includes("insufficient")) {
          errorMessage = "Insufficient balance for swap and gas fees";
        } else if (errorMessage.includes("slippage")) {
          errorMessage = "Price moved too much - try again with higher slippage";
        } else if (errorMessage.includes("gas")) {
          errorMessage = "Gas estimation failed - please try again";
        }
        
        toast({
          variant: "destructive",
          title: "Swap Failed", 
          description: errorMessage
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
    <AppLayout
      headerProps={{ showBackButton: true, backPath: "/" }}
      showBottomNavOnAllScreens={true}
      className="overflow-y-auto h-[calc(100vh-8rem)]"
    >
      {/* Wallet Status */}
      {secureWalletAddress && (
        <div className="bg-card p-2 rounded-lg mb-2">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-primary" />
            <span className="text-sm text-foreground">
              Wallet: {secureWalletAddress.slice(0, 6)}...{secureWalletAddress.slice(-4)}
            </span>
          </div>
        </div>
      )}

      {/* Swap Interface */}
      <div className="relative flex flex-col gap-1 my-4">
        {/* From Section */}
        <div className="bg-card p-3 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">From</span>
            <span className="text-sm text-muted-foreground">Balance: {fromBalance.toFixed(fromAsset === 'XAUT' ? 6 : 2)} {fromAsset}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-10 h-10 ${
                fromAsset === 'XAUT' ? 'bg-yellow-600' : 
                fromAsset === 'TRZRY' ? 'bg-green-600' : 'bg-blue-600'
              } rounded-full flex items-center justify-center`}>
                <span className="text-white text-xs font-bold">{fromAsset}</span>
              </div>
              <div>
                <span className="text-foreground text-lg font-bold">{fromAsset}</span>
                <div className="text-xs text-muted-foreground">{getNetworkForAsset(fromAsset)}</div>
              </div>
              <ChevronDown className="text-muted-foreground" size={20} />
            </div>
            <Input
              className="bg-transparent border-none text-foreground text-right text-2xl font-bold placeholder:text-muted-foreground focus:ring-0"
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
            className="bg-accent rounded-full p-2 text-foreground border-4 border-card hover:bg-accent/80"
          >
            <ArrowUpDown size={20} />
          </Button>
        </div>

        {/* To Section */}
        <div className="bg-card p-3 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">To</span>
            <span className="text-sm text-muted-foreground">Balance: {toBalance.toFixed(toAsset === 'XAUT' ? 6 : 2)} {toAsset}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-10 h-10 ${
                toAsset === 'XAUT' ? 'bg-yellow-600' : 
                toAsset === 'TRZRY' ? 'bg-green-600' : 'bg-blue-600'
              } rounded-full flex items-center justify-center`}>
                <span className="text-white text-xs font-bold">{toAsset}</span>
              </div>
              <div>
                <span className="text-foreground text-lg font-bold">{toAsset}</span>
                <div className="text-xs text-muted-foreground">{getNetworkForAsset(toAsset)}</div>
              </div>
              <ChevronDown className="text-muted-foreground" size={20} />
            </div>
            <Input
              className="bg-transparent border-none text-foreground text-right text-2xl font-bold placeholder:text-muted-foreground focus:ring-0"
              placeholder="0.00"
              value={quote ? quote.outputAmount.toFixed(6) : ''}
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Trading Details */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center bg-card p-3 rounded-xl">
          <span className="text-foreground">Slippage Tolerance</span>
          <div className="flex items-center gap-2">
            <span className="text-foreground">0.5%</span>
            <Edit className="text-muted-foreground" size={16} />
          </div>
        </div>

        <div className="flex justify-between items-center bg-card p-3 rounded-xl">
          <span className="text-foreground">Transaction Fees</span>
          <span className="text-foreground">Auto-paid from {fromAsset} if needed</span>
        </div>

        <div className="flex justify-between items-center bg-card p-3 rounded-xl">
          <span className="text-foreground">Route</span>
          <span className="text-foreground">{fromAsset} → {toAsset}</span>
        </div>
        
        {quote && (
          <>
            <div className="flex justify-between items-center bg-card p-3 rounded-xl">
              <span className="text-foreground">Exchange Rate</span>
              <span className="text-foreground">${quote.exchangeRate.toFixed(2)}/{toAsset === 'XAUT' ? 'oz' : 'unit'}</span>
            </div>
            
            <div className="flex justify-between items-center bg-card p-3 rounded-xl">
              <span className="text-foreground">Platform Fee (0.8%)</span>
              <span className="text-foreground">
                {quote.fee.toFixed(6)} {fromAsset}
              </span>
            </div>
            
            <div className="flex justify-between items-center bg-card p-3 rounded-xl">
              <span className="text-foreground">Minimum Received</span>
              <span className="text-foreground">
                {quote.minimumReceived.toFixed(6)} {toAsset}
              </span>
            </div>

            <div className="flex justify-between items-center bg-card p-3 rounded-xl">
              <span className="text-foreground">You'll receive</span>
              <span className="text-foreground font-bold">
                ≈ {quote.outputAmount.toFixed(6)} {toAsset}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Bottom Button */}
      <div className="sticky bottom-0 bg-background pt-4 pb-2">
        {!secureWalletAddress ? (
          <Button 
            onClick={() => navigate("/wallet")}
            disabled={walletLoading}
            className="w-full h-14 bg-secondary text-secondary-foreground font-bold text-lg rounded-xl hover:bg-secondary/90"
          >
            {walletLoading ? "Setting up wallet..." : "Set up wallet to swap"}
          </Button>
        ) : (
          <Button 
            onClick={quote ? handleExecuteSwap : handlePreviewSwap}
            disabled={loading || !fromAmount}
            className="w-full h-14 bg-primary text-primary-foreground font-bold text-lg rounded-xl hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (quote ? "Executing Swap..." : "Generating Quote...") : quote ? "Execute Swap" : "Preview Swap"}
          </Button>
        )}
      </div>
    </AppLayout>
  );
};

export default Swap;