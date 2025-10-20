/**
 * Swap Page - 0x Gasless v2
 * Ethereum mainnet only
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ArrowUpDown, Wallet, AlertCircle, RefreshCw } from "lucide-react";
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
import { PasswordPrompt } from "@/components/wallet/PasswordPrompt";
import AppLayout from "@/components/AppLayout";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { useGaslessSwap } from "@/hooks/useGaslessSwap";
import { ethers } from "ethers";
import { getTokenDecimals } from "@/config/tokenAddresses";

// Ethereum-only assets
const AVAILABLE_ASSETS = [
  { symbol: 'USDC' as const, name: 'USDC', color: 'bg-blue-600' },
  { symbol: 'XAUT' as const, name: 'XAUT', color: 'bg-yellow-600' },
  { symbol: 'TRZRY' as const, name: 'TRZRY', color: 'bg-green-600' },
];

const Swap = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { balances, getBalance, refreshBalances } = useOptimizedWalletBalance();
  const { user } = useAuth();
  const { toast } = useToast();
  const { walletAddress: secureWalletAddress, getWalletAddress } = useSecureWallet();
  
  const [fromAsset, setFromAsset] = useState<'USDC' | 'XAUT' | 'TRZRY'>('USDC');
  const [toAsset, setToAsset] = useState<'USDC' | 'XAUT' | 'TRZRY'>('XAUT');
  const [fromAmount, setFromAmount] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [swapInProgress, setSwapInProgress] = useState(false);
  
  const { prices: cryptoPrices } = useCryptoPrices();
  const { price: goldPrice } = useGoldPrice();
  const { quote, loading, error, generateQuote, executeSwap, clearQuote } = useGaslessSwap();

  // Initialize wallet
  useEffect(() => {
    if (user && !secureWalletAddress) {
      getWalletAddress();
    }
    
    if (user) {
      refreshBalances();
    }
    
    // Handle URL parameters
    const toParam = searchParams.get('to');
    if (toParam && ['USDC', 'XAUT', 'TRZRY'].includes(toParam)) {
      setToAsset(toParam as 'USDC' | 'XAUT' | 'TRZRY');
      if (toParam !== 'USDC') {
        setFromAsset('USDC');
      }
    }
  }, [user, secureWalletAddress, getWalletAddress, searchParams, refreshBalances]);
  
  const fromBalance = getBalance(fromAsset);
  const toBalance = getBalance(toAsset);
  
  // Auto-generate quote as user types (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!user || !fromAmount || parseFloat(fromAmount) <= 0 || fromAsset === toAsset) {
        clearQuote();
        return;
      }

      try {
        await generateQuote({
          from: fromAsset,
          to: toAsset,
          amount: fromAmount
        });
      } catch (err: any) {
        console.error('Auto-quote error:', err);
        // Don't show toast for auto-quote errors
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [fromAmount, fromAsset, toAsset, user]);

  const handleFromAssetChange = (newAsset: 'USDC' | 'XAUT' | 'TRZRY') => {
    if (newAsset === toAsset) {
      setToAsset(fromAsset);
    }
    setFromAsset(newAsset);
    clearQuote();
  };

  const handleToAssetChange = (newAsset: 'USDC' | 'XAUT' | 'TRZRY') => {
    if (newAsset === fromAsset) {
      setFromAsset(toAsset);
    }
    setToAsset(newAsset);
    clearQuote();
  };

  const handleSwapTokens = () => {
    const temp = fromAsset;
    setFromAsset(toAsset);
    setToAsset(temp);
    clearQuote();
  };

  const handlePasswordConfirm = async (password: string) => {
    if (!quote || !user) return;

    try {
      setSwapInProgress(true);
      setShowPasswordPrompt(false);

      const result = await executeSwap({
        quote,
        password,
        userId: user.id,
        fromSymbol: fromAsset,
        toSymbol: toAsset
      });

      if (result.success) {
        toast({
          title: "Swap Submitted",
          description: `Swapping ${fromAsset} for ${toAsset}. Transaction hash: ${result.tradeHash?.substring(0, 10)}...`,
          variant: "default"
        });

        // Wait a bit then refresh balances
        setTimeout(() => {
          refreshBalances();
          setFromAmount('');
          clearQuote();
          setSwapInProgress(false);
        }, 3000);
      } else {
        throw new Error(result.message || result.error);
      }
    } catch (err: any) {
      console.error('Swap failed:', err);
      toast({
        title: "Swap Failed",
        description: err.message || 'Failed to execute swap',
        variant: "destructive"
      });
      setSwapInProgress(false);
    }
  };

  const calculateUSDValue = (asset: 'USDC' | 'XAUT' | 'TRZRY', amount: string): number => {
    const value = parseFloat(amount);
    if (isNaN(value)) return 0;

    if (asset === 'USDC') return value;
    if (asset === 'XAUT' && goldPrice) return value * Number(goldPrice);
    // TRZRY price approximation
    if (asset === 'TRZRY') return value * 0.1;
    
    return 0;
  };

  const formatAmount = (amount: string | undefined): string => {
    if (!amount) return '0';
    try {
      const decimals = getTokenDecimals(fromAsset);
      return parseFloat(ethers.formatUnits(amount, decimals)).toFixed(6);
    } catch {
      return amount;
    }
  };

  const exchangeRate = quote ? 
    (parseFloat(formatAmount(quote.buyAmount)) / parseFloat(fromAmount)).toFixed(6) : 
    null;

  const isWalletReady = user && secureWalletAddress;
  const canSwap = isWalletReady && fromAmount && parseFloat(fromAmount) > 0 && quote && !loading && !swapInProgress;

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-4 pb-20 md:pb-4">
        <div className="max-w-2xl mx-auto pt-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Swap</h1>
              <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">Ethereum</span>
            </div>
            <span className="text-xs text-muted-foreground bg-green-500/20 text-green-500 px-2 py-1 rounded">
              Gasless
            </span>
          </div>

          {/* Wallet Status */}
          {isWalletReady && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {secureWalletAddress?.substring(0, 6)}...{secureWalletAddress?.substring(38)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refreshBalances()}
                className="h-7"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Swap Interface */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            {/* From */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>From</span>
                <span>Balance: {fromBalance || '0.00'}</span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="flex-1 text-2xl h-14"
                />
                <Select value={fromAsset} onValueChange={handleFromAssetChange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ASSETS.map(asset => (
                      <SelectItem key={asset.symbol} value={asset.symbol}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${asset.color}`} />
                          {asset.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground">
                ≈ ${calculateUSDValue(fromAsset, fromAmount).toFixed(2)} USD
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwapTokens}
                className="rounded-full"
              >
                <ArrowUpDown className="h-5 w-5" />
              </Button>
            </div>

            {/* To */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>To</span>
                <span>Balance: {toBalance || '0.00'}</span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="0.00"
                  value={quote ? formatAmount(quote.buyAmount) : ''}
                  disabled
                  className="flex-1 text-2xl h-14"
                />
                <Select value={toAsset} onValueChange={handleToAssetChange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ASSETS.map(asset => (
                      <SelectItem key={asset.symbol} value={asset.symbol}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${asset.color}`} />
                          {asset.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {quote && (
                <div className="text-xs text-muted-foreground">
                  ≈ ${calculateUSDValue(toAsset, formatAmount(quote.buyAmount)).toFixed(2)} USD
                </div>
              )}
            </div>
          </div>

          {/* Quote Details */}
          {quote && (
            <div className="mt-4 bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exchange Rate</span>
                <span>1 {fromAsset} = {exchangeRate} {toAsset}</span>
              </div>
              {quote.fees?.integratorFee && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform Fee (0.8%)</span>
                  <span>{formatAmount(quote.fees.integratorFee.amount)} {toAsset}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price Impact</span>
                <span className={parseFloat(quote.estimatedPriceImpact) > 5 ? 'text-destructive' : ''}>
                  {(parseFloat(quote.estimatedPriceImpact) * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Action Button */}
          <div className="mt-6">
            {!isWalletReady ? (
              <Button
                className="w-full h-12"
                onClick={() => navigate('/wallet-management')}
              >
                <Wallet className="mr-2 h-4 w-4" />
                Set up wallet
              </Button>
            ) : (
              <Button
                className="w-full h-12"
                onClick={() => setShowPasswordPrompt(true)}
                disabled={!canSwap}
              >
                {loading ? 'Getting quote...' : swapInProgress ? 'Swapping...' : 'Swap'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <PasswordPrompt
        open={showPasswordPrompt}
        onOpenChange={setShowPasswordPrompt}
        onConfirm={handlePasswordConfirm}
      />
    </AppLayout>
  );
};

export default Swap;
