import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ArrowUpDown, Edit, Wallet, Repeat2, Coins } from "lucide-react";
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
  { symbol: 'XAUT_ARB' as const, name: 'XAUT', color: 'bg-yellow-600', chain: 'arbitrum' as Chain },
];

const Swap = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { balances, getBalance, refreshBalances, walletAddress } = useOptimizedWalletBalance();
  const { user } = useAuth();
  const { toast } = useToast();
  const { walletAddress: secureWalletAddress, getWalletAddress, loading: walletLoading } = useSecureWallet();
  
  const [currentChain, setCurrentChain] = useState<Chain>('arbitrum');
  const [fromAsset, setFromAsset] = useState<'USDC' | 'XAUT' | 'TRZRY' | 'USDC_ARB' | 'XAUT_ARB'>('USDC_ARB');
  const [toAsset, setToAsset] = useState<'USDC' | 'XAUT' | 'TRZRY' | 'USDC_ARB' | 'XAUT_ARB'>('XAUT_ARB');
  const [fromAmount, setFromAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [autoQuote, setAutoQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoQuoteLoading, setAutoQuoteLoading] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [activeIntentId, setActiveIntentId] = useState<string | null>(null);
  const [useGasless, setUseGasless] = useState(true); // Default to gasless
  const [gelatoFeeEstimate, setGelatoFeeEstimate] = useState<number>(0);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [lastDebugInfo, setLastDebugInfo] = useState<{url?: string, requestId?: string, error?: string} | null>(null);
  
  const { prices: cryptoPrices } = useCryptoPrices();
  const { price: goldPrice } = useGoldPrice();

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
    if (toParam && ['USDC', 'TRZRY', 'USDC_ARB', 'XAUT_ARB'].includes(toParam)) {
      setToAsset(toParam as 'USDC' | 'TRZRY' | 'USDC_ARB' | 'XAUT_ARB');
      
      // Switch chain based on asset
      if (toParam === 'TRZRY') {
        setCurrentChain('ethereum');
        setFromAsset('USDC');
        setToAsset('TRZRY');
      } else if (toParam === 'XAUT_ARB') {
        setCurrentChain('arbitrum');
        setFromAsset('USDC_ARB');
        setToAsset('XAUT_ARB');
      }
    }
  }, [user, secureWalletAddress, getWalletAddress, searchParams, refreshBalances]);
  
  const fromBalance = getBalance(fromAsset);
  const toBalance = getBalance(toAsset);
  
  const getNetworkForAsset = (asset: 'USDC' | 'XAUT' | 'TRZRY' | 'USDC_ARB' | 'XAUT_ARB') => {
    const assetConfig = AVAILABLE_ASSETS.find(a => a.symbol === asset);
    return assetConfig?.chain === 'arbitrum' ? 'Arbitrum' : 'Ethereum';
  };

  // Helper to get clean display name (removes _ARB suffix)
  const getDisplayName = (asset: 'USDC' | 'XAUT' | 'TRZRY' | 'USDC_ARB' | 'XAUT_ARB') => {
    if (asset === 'USDC_ARB') return 'USDC';
    if (asset === 'XAUT_ARB') return 'XAUT';
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
        setLastDebugInfo(null);
        return;
      }

      // All direct pairs are now supported: USDC↔XAUT, USDC↔TRZRY, XAUT↔TRZRY
      if (fromAsset === toAsset) {
        setAutoQuote(null);
        setQuoteError(null);
        setLastDebugInfo(null);
        return;
      }

      try {
        setAutoQuoteLoading(true);
        setQuoteError(null);
        setLastDebugInfo(null);
        
        const newQuote = await swapService.generateSwapQuote(
          fromAsset,
          toAsset,
          parseFloat(fromAmount),
          user.id
        );
        setAutoQuote(newQuote);
        setQuoteError(null);
        setLastDebugInfo(null);
      } catch (error) {
        console.error('Auto-quote generation failed:', error);
        
        // Parse error for debug info
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorObj = typeof error === 'object' && error !== null ? error as any : {};
        
        // Set debug info if available
        if (errorObj.requestUrl || errorObj.requestId) {
          setLastDebugInfo({
            url: errorObj.requestUrl,
            requestId: errorObj.requestId,
            error: errorMessage
          });
        }
        
        // Set user-friendly error message
        if (errorMessage.includes('no Route matched') || errorMessage.includes('404')) {
          const network = currentChain === 'arbitrum' ? 'Arbitrum' : 'Ethereum';
          const oppositeNetwork = currentChain === 'arbitrum' ? 'Ethereum' : 'Arbitrum';
          setQuoteError(`No route available for ${getDisplayName(fromAsset)} ↔ ${getDisplayName(toAsset)} on ${network}. Try switching to ${oppositeNetwork}.`);
        } else {
          setQuoteError('Unable to calculate swap price. Please try again.');
        }
        
        // Keep fromAmount, only clear autoQuote
        setAutoQuote(null);
      } finally {
        setAutoQuoteLoading(false);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [fromAmount, fromAsset, toAsset, user, currentChain]);

  const handleFromAssetChange = (newAsset: 'USDC' | 'TRZRY' | 'USDC_ARB' | 'XAUT_ARB') => {
    if (newAsset === toAsset) {
      setToAsset(fromAsset);
    }
    setFromAsset(newAsset);
    setQuote(null);
    setAutoQuote(null);
  };

  const handleToAssetChange = (newAsset: 'USDC' | 'TRZRY' | 'USDC_ARB' | 'XAUT_ARB') => {
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
      usdValue = amount * (goldPrice?.usd_per_oz || 0);
    } else if (baseAsset === 'TRZRY') {
      usdValue = amount;
    } else if (baseAsset === 'ETH') {
      usdValue = amount * (cryptoPrices?.ETH || 0);
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
            {currentChain === 'arbitrum' ? (
              // Arbitrum: Buy Gold layout
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-8 md:h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-500 to-amber-600">
                    <Coins className="text-white" size={20} />
                  </div>
                  <span className="text-base font-bold text-yellow-500 md:text-sm">
                    Buy Gold
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Arbitrum Network</div>
                    <div className="text-xs text-muted-foreground">For XAUT ↔ USDC swap</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newChain = 'ethereum';
                      setCurrentChain(newChain);
                      setFromAsset('USDC');
                      setToAsset('TRZRY');
                      toast({
                        title: "Switched to Ethereum",
                        description: "Now showing Ethereum assets",
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
                      setToAsset('XAUT_ARB');
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
          
          {/* Debug Mode Toggle */}
          <div className="bg-card p-3 rounded-lg md:p-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground md:text-xs">
                  🔍 Debug Mode
                </span>
              </div>
              <label className="relative inline-block w-10 h-5 md:w-8 md:h-4">
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                  className="opacity-0 w-0 h-0 peer"
                />
                <span className="absolute cursor-pointer inset-0 bg-muted rounded-full transition-colors peer-checked:bg-primary">
                  <span className="absolute left-0.5 top-0.5 h-4 w-4 md:h-3 md:w-3 bg-white rounded-full transition-transform peer-checked:translate-x-5 md:peer-checked:translate-x-4" />
                </span>
              </label>
            </div>
          </div>

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
              <span className="text-sm text-muted-foreground md:text-xs">Balance: {fromBalance.toFixed((fromAsset === 'XAUT' || fromAsset === 'XAUT_ARB') ? 6 : 2)} {getDisplayName(fromAsset)}</span>
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

          {/* Inline Error Banner */}
          {quoteError && (
            <div className="bg-destructive/10 border border-destructive/20 px-4 py-3 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-destructive text-sm flex-1">{quoteError}</span>
                {quoteError.includes('Try switching') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newChain = currentChain === 'arbitrum' ? 'ethereum' : 'arbitrum';
                      setCurrentChain(newChain);
                      if (newChain === 'ethereum') {
                        setFromAsset('USDC');
                        setToAsset('XAUT');
                      } else {
                        setFromAsset('USDC_ARB');
                        setToAsset('XAUT_ARB');
                      }
                      setQuoteError(null);
                      toast({
                        title: `Switched to ${newChain === 'arbitrum' ? 'Arbitrum' : 'Ethereum'}`,
                        description: `Now on ${newChain === 'arbitrum' ? 'Arbitrum' : 'Ethereum'} network`,
                      });
                    }}
                    className="shrink-0"
                  >
                    Switch Network
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Debug Info */}
          {debugMode && lastDebugInfo && (
            <div className="bg-muted/50 border border-border px-3 py-2 rounded-lg">
              <div className="text-xs space-y-1">
                <div className="font-semibold text-foreground">Debug Info:</div>
                {lastDebugInfo.url && (
                  <div className="text-muted-foreground break-all">
                    <span className="font-medium">URL:</span> {lastDebugInfo.url}
                  </div>
                )}
                {lastDebugInfo.requestId && (
                  <div className="text-muted-foreground">
                    <span className="font-medium">Request ID:</span> {lastDebugInfo.requestId}
                  </div>
                )}
                {lastDebugInfo.error && (
                  <div className="text-destructive">
                    <span className="font-medium">Error:</span> {lastDebugInfo.error}
                  </div>
                )}
              </div>
            </div>
          )}

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
              <span className="text-sm text-muted-foreground md:text-xs">Balance: {toBalance.toFixed((toAsset === 'XAUT' || toAsset === 'XAUT_ARB') ? 6 : 2)} {getDisplayName(toAsset)}</span>
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
                  value={(quote || autoQuote) ? (quote || autoQuote)!.outputAmount.toFixed(6) : autoQuoteLoading ? '...' : ''}
                  readOnly
                />
                {((quote || autoQuote)?.outputAmount) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ≈ {calculateUSDValue(toAsset, (quote || autoQuote)!.outputAmount)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

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
                <span className="text-base text-foreground md:text-sm">${quote.exchangeRate.toFixed(2)}/{toAsset === 'XAUT_ARB' ? 'oz' : 'unit'}</span>
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