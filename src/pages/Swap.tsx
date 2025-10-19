import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ArrowUpDown, Edit, Wallet, Repeat2, Coins, AlertCircle, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOptimizedWalletBalance } from "@/hooks/useOptimizedWalletBalance";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSecureWallet } from "@/hooks/useSecureWallet";
import { swapService, SwapQuote } from "@/services/swapService";
import { PasswordPrompt } from "@/components/wallet/PasswordPrompt";
import { useTransactionMonitor } from "@/hooks/useTransactionMonitor";
import AppLayout from "@/components/AppLayout";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { useGoldPrice } from "@/hooks/useGoldPrice";

type Chain = 'ethereum' | 'arbitrum';

const AVAILABLE_ASSETS = [
  // Ethereum assets
  { symbol: 'USDC' as const, name: 'USDC', color: 'bg-blue-600', chain: 'ethereum' as Chain },
  { symbol: 'XAUT' as const, name: 'XAUT', color: 'bg-yellow-600', chain: 'ethereum' as Chain },
  { symbol: 'TRZRY' as const, name: 'TRZRY', color: 'bg-green-600', chain: 'ethereum' as Chain },
  
  // Arbitrum assets
  { symbol: 'USDC_ARB' as const, name: 'USDC', color: 'bg-blue-600', chain: 'arbitrum' as Chain },
  { symbol: 'XAUT0_ARB' as const, name: 'XAUT0', color: 'bg-yellow-600', chain: 'arbitrum' as Chain },
];

const Swap = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { balances, getBalance, refreshBalances, walletAddress } = useOptimizedWalletBalance();
  const { user } = useAuth();
  const { toast } = useToast();
  const { walletAddress: secureWalletAddress, getWalletAddress, loading: walletLoading } = useSecureWallet();
  
  const [currentChain, setCurrentChain] = useState<Chain>('ethereum');
  const [fromAsset, setFromAsset] = useState<'USDC' | 'XAUT' | 'TRZRY' | 'USDC_ARB' | 'XAUT0_ARB'>('USDC');
  const [toAsset, setToAsset] = useState<'USDC' | 'XAUT' | 'TRZRY' | 'USDC_ARB' | 'XAUT0_ARB'>('XAUT');
  const [fromAmount, setFromAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [autoQuote, setAutoQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoQuoteLoading, setAutoQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [activeIntentId, setActiveIntentId] = useState<string | null>(null);
  const [useGasless, setUseGasless] = useState(true); // Default to gasless
  const [gelatoFeeEstimate, setGelatoFeeEstimate] = useState<number>(0);
  
  const { prices: cryptoPrices, loading: cryptoPricesLoading } = useCryptoPrices();
  const { price: goldPrice, loading: goldPriceLoading } = useGoldPrice();

  // Debug logging for price data
  useEffect(() => {
    console.log('💰 Crypto Prices:', cryptoPrices, 'Loading:', cryptoPricesLoading);
    console.log('🪙 Gold Price:', goldPrice, 'Loading:', goldPriceLoading);
  }, [cryptoPrices, cryptoPricesLoading, goldPrice, goldPriceLoading]);

  // Monitor transaction status with real-time updates
  useTransactionMonitor({
    intentId: activeIntentId,
    onComplete: () => {
      // Refresh balances and reset UI after successful swap
      refreshBalances();
      setFromAmount('');
      setQuote(null);
      setAutoQuote(null);
      setActiveIntentId(null);
      setLoading(false);
    },
    onFailed: () => {
      // Reset UI after failed swap
      setActiveIntentId(null);
      setLoading(false);
    }
  });

  // Handle URL parameters and initialize wallet
  useEffect(() => {
    if (user && !secureWalletAddress) {
      getWalletAddress();
    }
    
    // Force fresh balance refresh on mount to ensure ETH shows
    if (user) {
      console.log('🔄 Forcing balance refresh on Swap page mount');
      refreshBalances();
    }
    
    // Handle URL parameters for pre-selecting assets and chain
    const toParam = searchParams.get('to');
    if (toParam && ['USDC', 'XAUT', 'TRZRY', 'USDC_ARB', 'XAUT0_ARB'].includes(toParam)) {
      setToAsset(toParam as 'USDC' | 'XAUT' | 'TRZRY' | 'USDC_ARB' | 'XAUT0_ARB');
      
      // Switch chain based on asset
      if (toParam === 'TRZRY' || toParam === 'XAUT') {
        setCurrentChain('ethereum');
        setFromAsset('USDC');
        setToAsset(toParam as 'TRZRY' | 'XAUT');
      } else if (toParam === 'USDC_ARB' || toParam === 'XAUT0_ARB') {
        setCurrentChain('arbitrum');
        setFromAsset('USDC_ARB');
      }
    }
  }, [user, secureWalletAddress, getWalletAddress, searchParams, refreshBalances]);
  
  const fromBalance = getBalance(fromAsset);
  const toBalance = getBalance(toAsset);
  
  const getNetworkForAsset = (asset: 'USDC' | 'XAUT' | 'TRZRY' | 'USDC_ARB' | 'XAUT0_ARB') => {
    const assetConfig = AVAILABLE_ASSETS.find(a => a.symbol === asset);
    return assetConfig?.chain === 'arbitrum' ? 'Arbitrum' : 'Ethereum';
  };

  // Helper to get clean display name (removes _ARB suffix)
  const getDisplayName = (asset: 'USDC' | 'XAUT' | 'TRZRY' | 'USDC_ARB' | 'XAUT0_ARB') => {
    if (asset === 'USDC_ARB') return 'USDC';
    if (asset === 'XAUT0_ARB') return 'XAUT0';
    return asset;
  };

  // Get available assets filtered by current chain
  const getAvailableAssets = (chain: Chain) => {
    return AVAILABLE_ASSETS.filter(asset => asset.chain === chain);
  };
  
  // Auto-generate quote as user types (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!user || !fromAmount || parseFloat(fromAmount) <= 0) {
        setAutoQuote(null);
        setQuoteError(null);
        return;
      }

      // All direct pairs are now supported: USDC↔XAUT, USDC↔TRZRY, XAUT↔TRZRY
      if (fromAsset === toAsset) {
        setAutoQuote(null);
        setQuoteError(null);
        return;
      }

      try {
        setAutoQuoteLoading(true);
        setQuoteError(null);
        const newQuote = await swapService.generateSwapQuote(
          fromAsset,
          toAsset,
          parseFloat(fromAmount),
          user.id
        );
        setAutoQuote(newQuote);
      } catch (error) {
        console.error('Auto-quote generation failed:', error);
        setAutoQuote(null);
        
        // Set user-friendly error message
        const errorMessage = error instanceof Error ? error.message : 'Failed to get quote';
        if (errorMessage.includes('not supported') && errorMessage.includes('Arbitrum') && errorMessage.includes('XAUT')) {
          setQuoteError('XAUT is not available on Arbitrum. Please switch to Ethereum to trade XAUT.');
        } else if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('authentication')) {
          setQuoteError('API authentication failed. Please check configuration.');
        } else if (errorMessage.includes('no liquidity') || errorMessage.includes('no Route matched') || errorMessage.includes('404')) {
          setQuoteError(`No liquidity available for ${getDisplayName(fromAsset)} → ${getDisplayName(toAsset)} on ${currentChain === 'arbitrum' ? 'Arbitrum' : 'Ethereum'}. Try switching networks.`);
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          setQuoteError('Rate limit reached. Please wait a moment and try again.');
        } else if (errorMessage.includes('allowanceTarget')) {
          setQuoteError('Token approval configuration error. Please contact support.');
        } else {
          setQuoteError('Unable to calculate swap quote. Please try again.');
        }
      } finally {
        setAutoQuoteLoading(false);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [fromAmount, fromAsset, toAsset, user]);

  const handleFromAssetChange = (newAsset: 'USDC' | 'XAUT' | 'TRZRY' | 'USDC_ARB' | 'XAUT0_ARB') => {
    if (newAsset === toAsset) {
      setToAsset(fromAsset);
    }
    setFromAsset(newAsset);
    setQuote(null);
    setAutoQuote(null);
  };

  const handleToAssetChange = (newAsset: 'USDC' | 'XAUT' | 'TRZRY' | 'USDC_ARB' | 'XAUT0_ARB') => {
    if (newAsset === fromAsset) {
      setFromAsset(toAsset);
    }
    setToAsset(newAsset);
    
    // Auto-switch chain based on selected asset
    const assetConfig = AVAILABLE_ASSETS.find(a => a.symbol === newAsset);
    if (assetConfig && assetConfig.chain !== currentChain) {
      setCurrentChain(assetConfig.chain);
      toast({
        title: `Switched to ${assetConfig.chain === 'arbitrum' ? 'Arbitrum' : 'Ethereum'}`,
        description: `${newAsset} is available on ${assetConfig.chain === 'arbitrum' ? 'Arbitrum' : 'Ethereum'} network`,
      });
    }
    
    setQuote(null);
    setAutoQuote(null);
  };

  const handleSwapTokens = () => {
    const tempAsset = fromAsset;
    setFromAsset(toAsset);
    setToAsset(tempAsset);
    setFromAmount('');
    setQuote(null);
    setAutoQuote(null);
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
        description: `You don't have enough ${getDisplayName(fromAsset)}`
      });
      return;
    }

    // All direct pairs are supported (validation in swapService)
    
    try {
      setLoading(true);
      const newQuote = await swapService.generateSwapQuote(
        fromAsset,
        toAsset,
        parseFloat(fromAmount),
        user.id
      );
      
      setQuote(newQuote);
      
      // Estimate gasless fee (0x includes this in quote)
      const estimatedFee = newQuote.outputAmount * 0.005; // ~0.5%
      setGelatoFeeEstimate(estimatedFee);
      
      toast({
        title: "Quote Generated",
        description: `Quote valid for 10 minutes. You'll receive ≈${newQuote.outputAmount.toFixed(6)} ${getDisplayName(toAsset)} (minus ~${estimatedFee.toFixed(4)} ${getDisplayName(toAsset)} relay fee)`
      });
    } catch (error) {
      console.error('Quote generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate swap quote';
      toast({
        variant: "destructive",
        title: "Quote Failed", 
        description: errorMessage
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
    const now = new Date();
    const expiresAt = new Date(quote.expiresAt);
    if (now > expiresAt) {
      const expiredMinutesAgo = Math.floor((now.getTime() - expiresAt.getTime()) / 60000);
      toast({
        variant: "destructive",
        title: "Quote Expired",
        description: `Quote expired ${expiredMinutesAgo} minutes ago. Please generate a new quote.`
      });
      setQuote(null);
      return;
    }

    // Prompt for wallet password before executing
    setShowPasswordPrompt(true);
  };

  const handlePasswordConfirm = async (walletPassword: string) => {
    if (!user || !quote) return;
    
    try {
      setLoading(true);
      setShowPasswordPrompt(false);
      
      // Execute the swap transaction with wallet password (or gasless)
      console.log(`🔄 Executing ${useGasless ? 'GASLESS' : 'traditional'} swap transaction...`);
      const result = await swapService.executeSwap(quote.id, user.id, walletPassword, useGasless);
      
      if (result.success) {
        console.log('✅ Swap completed successfully');
        toast({
          title: "Swap Successful! 🎉",
          description: "Transaction completed successfully",
        });
        await refreshBalances();
        setFromAmount('');
        setQuote(null);
        setAutoQuote(null);
        setLoading(false);
      } else {
        console.error('❌ Swap failed:', result.error);
        
        // Enhanced error messages
        let errorMessage = result.error || "Swap execution failed";
        
        if (errorMessage.includes("password")) {
          errorMessage = "Invalid wallet password. Please try again.";
        } else if (errorMessage.includes("insufficient")) {
          errorMessage = "Insufficient balance for swap and gas fees";
        } else if (errorMessage.includes("slippage")) {
          errorMessage = "Price moved too much - try again with higher slippage";
        } else if (errorMessage.includes("gas")) {
          errorMessage = "Gas estimation failed - please try again";
        } else if (errorMessage.includes("Too Many Requests") || errorMessage.includes("rate") || errorMessage.includes("throttle")) {
          errorMessage = "Network is busy. Please wait 30 seconds and try again.";
        }
        
        toast({
          variant: "destructive",
          title: "Swap Failed", 
          description: errorMessage
        });
        setLoading(false);
      }
    } catch (error) {
      console.error('Swap execution error:', error);
      toast({
        variant: "destructive",
        title: "Swap Error",
        description: "Failed to execute swap"
      });
      setLoading(false);
    }
  };

  const calculateUSDValue = (asset: string, amount: number): string => {
    if (!amount || isNaN(amount)) return '$0.00';
    
    let usdValue = 0;
    const baseAsset = asset.replace('_ARB', '');
    
    if (baseAsset === 'USDC') {
      usdValue = amount;
    } else if (baseAsset === 'XAUT') {
      const xautPrice = goldPrice?.usd_per_oz;
      if (!xautPrice) {
        console.warn('⚠️ XAUT price not loaded yet');
        return 'Loading...';
      }
      usdValue = amount * xautPrice;
    } else if (baseAsset === 'TRZRY') {
      usdValue = amount;
    } else if (baseAsset === 'ETH') {
      const ethPrice = cryptoPrices?.ETH;
      if (!ethPrice) {
        console.warn('⚠️ ETH price not loaded yet');
        return 'Loading...';
      }
      usdValue = amount * ethPrice;
    }
    
    return `$${usdValue.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  return (
    <AppLayout
      headerProps={{ showBackButton: true, backPath: "/" }}
      showBottomNavOnAllScreens={true}
      className="flex flex-col h-full overflow-hidden"
    >
      <div className="flex-1 flex flex-col px-4 sm:px-5 py-4 space-y-3 md:px-6 md:py-3 md:space-y-3 max-w-none w-full md:max-w-4xl mx-auto">
        {/* Chain Switcher */}
        <div className="bg-card p-4 rounded-xl border-2 border-primary/20 md:p-3">
          <div className="flex items-center justify-between">
            {currentChain === 'ethereum' ? (
              // Ethereum: Full Asset Support
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-8 md:h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600">
                    <Coins className="text-white" size={20} />
                  </div>
                  <span className="text-base font-bold text-purple-500 md:text-sm">
                    Swap Assets
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Ethereum Mainnet</div>
                    <div className="text-xs text-muted-foreground">USDC, XAUT, TRZRY</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newChain = 'arbitrum';
                      setCurrentChain(newChain);
                      setFromAsset('USDC_ARB');
                      setToAsset('USDC_ARB');
                      toast({
                        title: "Switched to Arbitrum",
                        description: "Now showing Arbitrum assets",
                      });
                    }}
                    className="gap-2"
                  >
                    <Repeat2 size={14} />
                    Switch
                  </Button>
                </div>
              </>
            ) : (
              // Ethereum: Buy TRZRY layout
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-8 md:h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-600">
                    <span className="text-white text-sm font-bold md:text-xs">ETH</span>
                  </div>
                  <span className="text-base font-bold text-purple-500 md:text-sm">
                    Buy TRZRY
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Ethereum Network</div>
                    <div className="text-xs text-muted-foreground">For TRZRY ↔ USDC swaps</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newChain = 'arbitrum';
                      setCurrentChain(newChain);
                      setFromAsset('USDC_ARB');
                      setToAsset('USDC_ARB');
                      toast({
                        title: "Switched to Arbitrum",
                        description: "Now showing Arbitrum assets",
                      });
                    }}
                    className="gap-2"
                  >
                    <Repeat2 size={14} />
                    Switch
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Wallet & Gasless Status */}
        <div className="flex flex-col gap-2 md:gap-1">
          {secureWalletAddress && (
            <div className="bg-card p-3 rounded-lg md:p-2">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-primary md:w-3.5 md:h-3.5" />
                <span className="text-sm text-foreground md:text-xs">
                  Wallet: {secureWalletAddress.slice(0, 6)}...{secureWalletAddress.slice(-4)}
                </span>
              </div>
            </div>
          )}
          
          {/* Gasless Toggle */}
          <div className="bg-card p-3 rounded-lg md:p-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground md:text-xs">
                  ⚡ Gasless Swap
                </span>
                <span className="text-xs text-muted-foreground">
                  {useGasless ? 'No ETH needed' : 'Requires ETH for gas'}
                </span>
              </div>
              <label className="relative inline-block w-10 h-5 md:w-8 md:h-4">
                <input
                  type="checkbox"
                  checked={useGasless}
                  onChange={(e) => setUseGasless(e.target.checked)}
                  className="opacity-0 w-0 h-0 peer"
                />
                <span className="absolute cursor-pointer inset-0 bg-muted rounded-full transition-colors peer-checked:bg-primary">
                  <span className="absolute left-0.5 top-0.5 h-4 w-4 md:h-3 md:w-3 bg-white rounded-full transition-transform peer-checked:translate-x-5 md:peer-checked:translate-x-4" />
                </span>
              </label>
            </div>
            {useGasless && quote && gelatoFeeEstimate > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Relay fee: ~{gelatoFeeEstimate.toFixed(4)} {getDisplayName(toAsset)} deducted from output
              </p>
            )}
          </div>
        </div>

        {/* Swap Interface */}
        <div className="relative flex flex-col gap-2 md:gap-1">
          {/* From Section */}
        <div className="bg-card px-4 sm:px-5 py-4 rounded-xl md:px-6 md:py-3">
            <div className="flex justify-between items-center mb-2 md:mb-1">
              <span className="text-sm text-muted-foreground md:text-xs">From</span>
              <span className="text-sm text-muted-foreground md:text-xs">Balance: {fromBalance.toFixed(fromAsset === 'XAUT' ? 6 : 2)} {getDisplayName(fromAsset)}</span>
            </div>
            <div className="flex items-center gap-4 md:gap-3">
              <Select value={fromAsset} onValueChange={handleFromAssetChange}>
                <SelectTrigger className="flex-1 border-none bg-transparent h-auto p-0 hover:bg-transparent">
                  <div className="flex items-center gap-3 md:gap-2">
                    <div className={`w-10 h-10 md:w-8 md:h-8 ${
                      AVAILABLE_ASSETS.find(a => a.symbol === fromAsset)?.color
                    } rounded-full flex items-center justify-center`}>
                      <span className="text-white text-sm font-bold md:text-xs">{getDisplayName(fromAsset)}</span>
                    </div>
              <div className="flex items-center gap-2">
                <div>
                  <span className="text-foreground text-lg font-bold md:text-base">{getDisplayName(fromAsset)}</span>
                  <div className="text-sm text-muted-foreground md:text-xs">
                    {getNetworkForAsset(fromAsset)}
                  </div>
                </div>
              </div>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {getAvailableAssets(currentChain).map((asset) => (
                    <SelectItem key={asset.symbol} value={asset.symbol}>
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 ${asset.color} rounded-full flex items-center justify-center`}>
                          <span className="text-white text-xs font-bold">{getDisplayName(asset.symbol)}</span>
                        </div>
                        <div>
                          <div className="font-medium">{getDisplayName(asset.symbol)}</div>
                          <div className="text-xs text-muted-foreground">{asset.name}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-col items-end flex-1">
                <Input
                  className="bg-transparent border-none text-foreground text-right text-2xl font-bold placeholder:text-muted-foreground focus:ring-0 md:text-xl min-h-[44px] md:min-h-[auto]"
                  placeholder="0.00"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                />
                {fromAmount && parseFloat(fromAmount) > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ≈ {calculateUSDValue(fromAsset, parseFloat(fromAmount))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleSwapTokens}
              className="bg-accent rounded-full p-2.5 md:p-1.5 text-foreground border-2 border-card hover:bg-accent/80 w-12 h-12 md:w-auto md:h-auto"
            >
              <ArrowUpDown size={20} className="md:w-4 md:h-4" />
            </Button>
          </div>

          {/* To Section */}
          <div className="bg-card px-4 sm:px-5 py-4 rounded-xl md:px-6 md:py-3">
            <div className="flex justify-between items-center mb-2 md:mb-1">
              <span className="text-sm text-muted-foreground md:text-xs">To</span>
              <span className="text-sm text-muted-foreground md:text-xs">Balance: {toBalance.toFixed(toAsset === 'XAUT' ? 6 : 2)} {getDisplayName(toAsset)}</span>
            </div>
            <div className="flex items-center gap-4 md:gap-3">
              <Select value={toAsset} onValueChange={handleToAssetChange}>
                <SelectTrigger className="flex-1 border-none bg-transparent h-auto p-0 hover:bg-transparent">
                  <div className="flex items-center gap-3 md:gap-2">
                    <div className={`w-10 h-10 md:w-8 md:h-8 ${
                      AVAILABLE_ASSETS.find(a => a.symbol === toAsset)?.color
                    } rounded-full flex items-center justify-center`}>
                      <span className="text-white text-sm font-bold md:text-xs">{getDisplayName(toAsset)}</span>
                    </div>
              <div className="flex items-center gap-2">
                <div>
                  <span className="text-foreground text-lg font-bold md:text-base">{getDisplayName(toAsset)}</span>
                  <div className="text-sm text-muted-foreground md:text-xs">
                    {getNetworkForAsset(toAsset)}
                  </div>
                </div>
              </div>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {getAvailableAssets(currentChain).map((asset) => (
                    <SelectItem key={asset.symbol} value={asset.symbol}>
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 ${asset.color} rounded-full flex items-center justify-center`}>
                          <span className="text-white text-xs font-bold">{getDisplayName(asset.symbol)}</span>
                        </div>
                        <div>
                          <div className="font-medium">{getDisplayName(asset.symbol)}</div>
                          <div className="text-xs text-muted-foreground">{asset.name}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-col items-end flex-1">
                <Input
                  className="bg-transparent border-none text-foreground text-right text-2xl font-bold placeholder:text-muted-foreground focus:ring-0 md:text-xl min-h-[44px] md:min-h-[auto]"
                  placeholder="0.00"
                  value={
                    (quote || autoQuote) ? (quote || autoQuote)!.outputAmount.toFixed(6) : 
                    autoQuoteLoading ? '...' : 
                    quoteError ? '...' : 
                    ''
                  }
                  readOnly
                />
                {autoQuoteLoading && (
                  <div className="text-xs text-muted-foreground mt-1">Calculating...</div>
                )}
                {quoteError && !autoQuoteLoading && (
                  <div className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Quote unavailable
                  </div>
                )}
                {((quote || autoQuote)?.outputAmount) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ≈ {calculateUSDValue(toAsset, (quote || autoQuote)!.outputAmount)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quote Error Message */}
        {quoteError && fromAmount && parseFloat(fromAmount) > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg md:p-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-yellow-500 mb-1">Quote Unavailable</h4>
                <p className="text-xs text-yellow-500/80">{quoteError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAutoQuote(null);
                    setQuoteError(null);
                    // Trigger re-fetch by updating amount slightly
                    const currentAmount = parseFloat(fromAmount);
                    setFromAmount(String(currentAmount + 0.000001));
                    setTimeout(() => setFromAmount(String(currentAmount)), 100);
                  }}
                  className="mt-2 gap-2"
                >
                  <RefreshCw size={14} />
                  Retry Quote
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Trading Details */}
        <div className="space-y-2 flex-1 overflow-y-auto md:space-y-1.5">
          <div className="flex justify-between items-center bg-card px-4 sm:px-5 py-3 rounded-lg md:px-4 md:py-2">
            <span className="text-base text-foreground md:text-sm">Slippage Tolerance</span>
            <div className="flex items-center gap-2 md:gap-1">
              <span className="text-base text-foreground md:text-sm">0.5%</span>
              <Edit className="text-muted-foreground" size={18} />
            </div>
          </div>

          <div className="flex justify-between items-center bg-card px-4 sm:px-5 py-3 rounded-lg md:px-4 md:py-2">
            <span className="text-base text-foreground md:text-sm">Transaction Fees</span>
            <span className="text-base text-foreground md:text-sm">Auto-paid from {fromAsset}</span>
          </div>

          <div className="flex justify-between items-center bg-card px-4 sm:px-5 py-3 rounded-lg md:px-4 md:py-2">
            <span className="text-base text-foreground md:text-sm">Route</span>
            <span className="text-base text-foreground md:text-sm">{fromAsset} → {toAsset}</span>
          </div>
          
          {quote && (
            <>
              <div className="flex justify-between items-center bg-card px-4 sm:px-5 py-3 rounded-lg md:px-4 md:py-2">
                <span className="text-base text-foreground md:text-sm">Exchange Rate</span>
                <span className="text-base text-foreground md:text-sm">${quote.exchangeRate.toFixed(2)}/{toAsset === 'XAUT' ? 'oz' : 'unit'}</span>
              </div>
              
              <div className="flex justify-between items-center bg-card px-4 sm:px-5 py-3 rounded-lg md:px-4 md:py-2">
                <span className="text-base text-foreground md:text-sm">Platform Fee (0.8%)</span>
                <span className="text-base text-foreground md:text-sm">
                  {quote.platformFee.toFixed(6)} {toAsset}
                </span>
              </div>
              
              <div className="flex justify-between items-center bg-card px-4 sm:px-5 py-3 rounded-lg md:px-4 md:py-2">
                <span className="text-base text-foreground md:text-sm">Network Fee (Gasless)</span>
                <span className="text-base text-green-600 md:text-sm font-medium">
                  ~{quote.networkFee.toFixed(4)} {toAsset} (deducted from output)
                </span>
              </div>
              
              <div className="flex justify-between items-center bg-card px-4 sm:px-5 py-3 rounded-lg md:px-4 md:py-2">
                <span className="text-base text-foreground md:text-sm">Minimum Received</span>
                <span className="text-base text-foreground md:text-sm">
                  {(quote.outputAmount * 0.995).toFixed(6)} {toAsset}
                </span>
              </div>

              <div className="flex justify-between items-center bg-card px-4 sm:px-5 py-3 rounded-lg border-2 border-primary md:px-4 md:py-2">
                <span className="text-base text-foreground font-semibold md:text-sm">You'll receive (net)</span>
                <span className="text-base text-foreground font-bold md:text-sm">
                  ≈ {quote.outputAmount.toFixed(6)} {toAsset}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Bottom Button */}
        <div className="pt-3 md:pt-2 space-y-2">
          {!secureWalletAddress ? (
            <Button 
              onClick={() => navigate("/wallet")}
              disabled={walletLoading}
              className="w-full h-14 md:h-12 bg-secondary text-secondary-foreground font-bold text-lg md:text-base rounded-xl hover:bg-secondary/90"
            >
              {walletLoading ? "Setting up wallet..." : "Set up wallet to swap"}
            </Button>
          ) : (
            <Button 
              onClick={quote ? handleExecuteSwap : handlePreviewSwap}
              disabled={loading || !fromAmount}
              className="w-full h-14 md:h-12 bg-primary text-primary-foreground font-bold text-lg md:text-base rounded-xl hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (quote ? "Executing Swap..." : "Generating Quote...") : quote ? "Execute Swap" : "Preview Swap"}
            </Button>
          )}
        </div>
      </div>

      {/* Password Prompt */}
      <PasswordPrompt
        open={showPasswordPrompt}
        onOpenChange={setShowPasswordPrompt}
        onConfirm={handlePasswordConfirm}
        loading={loading}
      />
    </AppLayout>
  );
};

export default Swap;