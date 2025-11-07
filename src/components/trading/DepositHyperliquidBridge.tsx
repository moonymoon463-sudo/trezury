import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, Clock, DollarSign, CheckCircle2, AlertCircle, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SUPPORTED_BRIDGE_CHAINS, BRIDGE_PROVIDERS } from '@/config/hyperliquid';
import { useHyperliquidBridge } from '@/hooks/useHyperliquidBridge';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useWalletBalance } from '@/hooks/useWalletBalance';

interface DepositHyperliquidBridgeProps {
  hyperliquidAddress: string;
  onSuccess?: () => void;
}

const getExplorerUrl = (chain: string, txHash: string) => {
  const explorers: Record<string, string> = {
    ethereum: 'https://etherscan.io/tx/',
    arbitrum: 'https://arbiscan.io/tx/',
    optimism: 'https://optimistic.etherscan.io/tx/',
    polygon: 'https://polygonscan.com/tx/',
    base: 'https://basescan.org/tx/',
    bsc: 'https://bscscan.com/tx/',
    avalanche: 'https://snowtrace.io/tx/',
    solana: 'https://solscan.io/tx/',
  };
  return `${explorers[chain] || 'https://etherscan.io/tx/'}${txHash}`;
};

export const DepositHyperliquidBridge = ({ hyperliquidAddress, onSuccess }: DepositHyperliquidBridgeProps) => {
  const [sourceWallet, setSourceWallet] = useState<'internal' | 'external'>('external');
  const [sourceChain, setSourceChain] = useState('ethereum');
  const [bridgeProvider, setBridgeProvider] = useState('across');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'input' | 'review' | 'processing' | 'complete'>('input');
  const { toast } = useToast();
  const { wallet } = useWalletConnection();
  const { balances, walletAddress: internalWalletAddress } = useWalletBalance();
  
  const { 
    quote, 
    loading: quoteLoading, 
    getQuote, 
    executeBridge,
    checkStatus,
    bridgeStatus 
  } = useHyperliquidBridge();

  const selectedChain = SUPPORTED_BRIDGE_CHAINS.find(c => c.id === sourceChain);
  const selectedProvider = BRIDGE_PROVIDERS.find(p => p.id === bridgeProvider);

  // Filter providers based on selected chain
  const availableProviders = BRIDGE_PROVIDERS.filter(provider => 
    provider.supportedChains.includes(sourceChain)
  );

  // Auto-select recommended provider for the chain when chain changes
  useEffect(() => {
    if (sourceChain && availableProviders.length > 0) {
      const recommended = availableProviders.find(p => p.recommended);
      if (recommended) {
        setBridgeProvider(recommended.id);
      } else {
        setBridgeProvider(availableProviders[0].id);
      }
    }
  }, [sourceChain]);

  // Get source wallet balance for selected chain
  const getSourceBalance = () => {
    const balance = balances.find(b => 
      b.asset === 'USDC' && 
      b.chain === sourceChain
    );
    return balance?.amount || 0;
  };

  useEffect(() => {
    if (amount && parseFloat(amount) > 0 && sourceChain && bridgeProvider) {
      const timer = setTimeout(() => {
        const sourceAddress = sourceWallet === 'external' ? wallet.address : internalWalletAddress;
        const parsedAmount = parseFloat(amount);
        
        console.log('[DepositHyperliquidBridge] Getting quote with amount:', {
          rawAmount: amount,
          parsedAmount,
          type: typeof parsedAmount
        });
        
        getQuote({
          fromChain: sourceChain,
          toChain: 'hyperliquid',
          token: 'USDC',
          amount: parsedAmount,
          provider: bridgeProvider,
          destinationAddress: hyperliquidAddress,
          sourceWalletAddress: sourceAddress
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [amount, sourceChain, bridgeProvider, hyperliquidAddress, sourceWallet, wallet.address, internalWalletAddress, getQuote]);

  const handleBridge = async () => {
    if (!quote || !hyperliquidAddress) {
      toast({
        title: "Error",
        description: "Missing quote or trading wallet",
        variant: "destructive",
      });
      return;
    }

    // Validate password for internal wallet
    if (sourceWallet === 'internal' && !password) {
      toast({
        title: "Password Required",
        description: "Please enter your password to bridge with internal wallet",
        variant: "destructive",
      });
      return;
    }

    setStep('processing');
    let pollInterval: NodeJS.Timeout | null = null;

    // Safety timeout - force stop after 15 minutes
    const safetyTimeout = setTimeout(() => {
      if (pollInterval) clearInterval(pollInterval);
      setStep('input');
      toast({
        title: "Operation Timeout",
        description: "Bridge operation timed out. Please try again or check your transaction status.",
        variant: "destructive",
      });
    }, 15 * 60 * 1000); // 15 minutes

    try {
      const sourceAddress = sourceWallet === 'external' ? wallet.address : internalWalletAddress;
      const result = await executeBridge(quote as any, sourceAddress, sourceWallet, password);
      
      console.log('[DepositHyperliquidBridge] Bridge transaction submitted:', result);

      // Check if result indicates failure
      if (!result || !result.bridgeId) {
        throw new Error('Failed to create bridge transaction');
      }
      
      // Poll for status updates
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes (5s intervals)
      pollInterval = setInterval(async () => {
        attempts++;
        
        try {
          const status = await checkStatus(result.bridgeId);
          console.log('[DepositHyperliquidBridge] Bridge status:', status);
          
          if (status.status === 'completed') {
            if (pollInterval) clearInterval(pollInterval);
            clearTimeout(safetyTimeout);
            setStep('complete');
            toast({
              title: "Bridge Complete",
              description: `${amount} USDC has been deposited to your trading wallet`,
            });
            onSuccess?.();
          } else if (status.status === 'failed') {
            if (pollInterval) clearInterval(pollInterval);
            clearTimeout(safetyTimeout);
            setStep('input');
            toast({
              title: "Bridge Failed",
              description: status.error || "Transaction failed on chain. Please try again or contact support.",
              variant: "destructive",
            });
          } else if (attempts >= maxAttempts) {
            if (pollInterval) clearInterval(pollInterval);
            clearTimeout(safetyTimeout);
            setStep('input');
            toast({
              title: "Bridge Timeout",
              description: "Bridge is taking longer than expected. Transaction may still complete - check your wallet later.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('[DepositHyperliquidBridge] Status check failed:', error);
          // Continue polling unless we've hit max attempts
          if (attempts >= maxAttempts) {
            if (pollInterval) clearInterval(pollInterval);
            clearTimeout(safetyTimeout);
            setStep('input');
            toast({
              title: "Status Check Failed",
              description: "Unable to verify bridge status. Please check your wallet.",
              variant: "destructive",
            });
          }
        }
      }, 5000); // Poll every 5 seconds
      
    } catch (error: any) {
      console.error('[DepositHyperliquidBridge] Bridge failed:', error);
      if (pollInterval) clearInterval(pollInterval);
      clearTimeout(safetyTimeout);
      setStep('input');
      
      // Extract meaningful error message
      let errorMessage = "Failed to initiate bridge";
      if (error?.message) {
        if (error.message.includes('insufficient funds')) {
          errorMessage = "Insufficient funds in source wallet";
        } else if (error.message.includes('user rejected')) {
          errorMessage = "Transaction rejected by user";
        } else if (error.message.includes('invalid fee')) {
          errorMessage = "Bridge fee configuration error. Please try a different provider.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Bridge Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (step === 'complete') {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-status-success" />
            <CardTitle className="text-base text-foreground">Bridge Complete</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Your funds have been successfully bridged
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {bridgeStatus && (
            <div className="p-3 bg-background rounded-lg border border-border space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-foreground font-medium">{bridgeStatus.amount} USDC</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Transaction Hash</span>
                <a 
                  href={getExplorerUrl(sourceChain, bridgeStatus.txHash || '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-mono text-xs"
                >
                  {bridgeStatus.txHash?.slice(0, 10)}...
                </a>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="default" className="text-xs">Completed</Badge>
              </div>
            </div>
          )}
          <Button onClick={() => setStep('input')} variant="outline" className="w-full">
            Bridge More Funds
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'processing') {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">Processing Bridge</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {sourceWallet === 'internal' ? 'Executing bridge transaction...' : 'Please confirm in your wallet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6 space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-xs">This may take a few minutes...</p>
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <AlertCircle className="h-3 w-3 text-blue-500" />
            <AlertDescription className="text-xs">
              Your transaction is being processed on-chain. Do not close this window.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (step === 'review' && quote) {
    return (
      <Card className="bg-card border-border max-h-[calc(100vh-8rem)] overflow-y-auto">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm text-foreground">Review Bridge</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Confirm the details before proceeding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5 px-4 pb-4">
          <div className="flex items-center justify-between p-2 bg-background rounded-lg border border-border">
            <div className="flex items-center gap-1.5">
              {selectedChain?.iconUrl ? (
                <img src={selectedChain.iconUrl} alt={selectedChain.name} className="h-4 w-4 rounded-full" />
              ) : (
                <div className="text-base">{selectedChain?.icon}</div>
              )}
              <div>
                <p className="text-[10px] font-medium text-foreground">{selectedChain?.name}</p>
                <p className="text-xs text-muted-foreground">{amount} USDC</p>
              </div>
            </div>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <div className="flex items-center gap-1.5">
              <div className="text-base">🔵</div>
              <div>
                <p className="text-[10px] font-medium text-foreground">Trading Wallet</p>
                <p className="text-xs text-muted-foreground">{quote.estimatedOutput.toFixed(2)} USDC</p>
              </div>
            </div>
          </div>

          <div className="space-y-1 p-2 bg-background rounded-lg border border-border">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Source</span>
              <span className="text-foreground font-medium capitalize">{sourceWallet}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Provider</span>
              <span className="text-foreground font-medium">{selectedProvider?.name}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Time</span>
              <span className="text-foreground">{quote.estimatedTime}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Bridge Fee</span>
              <span className="text-foreground">${quote.fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Source Gas Fee</span>
              <span className="text-muted-foreground">
                {sourceChain === 'ethereum' ? '~$5-30' : 
                 sourceChain === 'arbitrum' ? '~$0.10-0.50' :
                 sourceChain === 'base' ? '~$0.05-0.30' :
                 sourceChain === 'optimism' ? '~$0.10-0.50' :
                 sourceChain === 'polygon' ? '~$0.50-2' :
                 sourceChain === 'bsc' ? '~$0.30-1' :
                 sourceChain === 'avalanche' ? '~$1-3' :
                 sourceChain === 'solana' ? '~$0.01-0.05' :
                 '~$0.50-5'}
              </span>
            </div>
            <div className="flex justify-between text-xs border-t border-border pt-1 mt-1 font-medium">
              <span className="text-foreground">You'll Receive</span>
              <span className="text-foreground font-bold">{quote.estimatedOutput.toFixed(2)} USDC</span>
            </div>
          </div>

          <Alert className="bg-primary/10 border-primary/20 py-1.5">
            <AlertCircle className="h-3 w-3 text-primary" />
            <AlertDescription className="text-[10px] text-foreground leading-relaxed">
              <strong>Trading Wallet:</strong> <span className="font-mono">{hyperliquidAddress.slice(0,6)}...{hyperliquidAddress.slice(-4)}</span>
            </AlertDescription>
          </Alert>

          {sourceWallet === 'internal' && (
            <div className="space-y-1">
              <Label className="text-xs text-foreground">Password</Label>
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background border-border h-8 text-xs"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('input')} className="flex-1 h-8 text-xs">
              Back
            </Button>
            <Button onClick={handleBridge} className="flex-1 h-8 text-xs" disabled={sourceWallet === 'internal' && !password}>
              Confirm
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sourceBalance = getSourceBalance();

  return (
    <Card className="bg-card border-border max-h-[calc(100vh-8rem)] overflow-y-auto">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm text-foreground">Bridge to Trading Wallet</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Deposit USDC from any supported blockchain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5 px-4 pb-4">
        <Alert className="bg-primary/10 border-primary/20 py-2">
          <AlertCircle className="h-3 w-3 text-primary" />
          <AlertDescription className="text-xs text-foreground leading-relaxed">
            <strong>Trading Wallet:</strong> <span className="font-mono">{hyperliquidAddress.slice(0,6)}...{hyperliquidAddress.slice(-4)}</span>
          </AlertDescription>
        </Alert>

        {sourceChain === 'ethereum' && (
          <Alert className="bg-yellow-500/10 border-yellow-500/30 py-2">
            <AlertCircle className="h-3 w-3 text-yellow-500" />
            <AlertDescription className="text-xs text-foreground leading-relaxed">
              <strong>⚠️ Ethereum Gas Fees:</strong> In addition to the {selectedProvider?.fees} bridge fee, 
              you'll pay $5-$30 in Ethereum gas fees depending on network congestion. 
              <br/><strong>Tip:</strong> Use Base or Arbitrum for 50x cheaper gas (~$0.10).
            </AlertDescription>
          </Alert>
        )}

        {sourceChain === 'solana' && (
          <Alert className="bg-purple-500/10 border-purple-500/30 py-2">
            <AlertCircle className="h-3 w-3 text-purple-500" />
            <AlertDescription className="text-xs text-foreground leading-relaxed">
              <strong>◎ Solana Bridge:</strong> Bridging from Solana requires SOL for transaction fees (~$0.01-0.05). 
              Uses {selectedProvider?.name || 'Wormhole'} protocol. Estimated time: {selectedProvider?.speed || '2-10min'}.
            </AlertDescription>
          </Alert>
        )}

        {sourceChain === 'avalanche' && (
          <Alert className="bg-red-500/10 border-red-500/30 py-2">
            <AlertCircle className="h-3 w-3 text-red-500" />
            <AlertDescription className="text-xs text-foreground leading-relaxed">
              <strong>🔺 Avalanche Bridge:</strong> Gas fees: $0.50-$2 in AVAX. 
              Bridge time: {selectedProvider?.speed || '1-5min'}. Uses {selectedProvider?.name || 'Stargate'}.
            </AlertDescription>
          </Alert>
        )}

        <Alert className="bg-blue-500/10 border-blue-500/30 py-2">
          <AlertCircle className="h-3 w-3 text-blue-500" />
          <AlertDescription className="text-xs text-foreground leading-relaxed">
            <strong>ℹ️ Note:</strong> Cross-chain bridging requires gas fees on the source chain. 
            Gasless transactions are not available for bridges. Use Base or Arbitrum for lowest gas costs.
          </AlertDescription>
        </Alert>

        {/* Source Wallet Selection */}
        <div className="space-y-1">
          <Label className="text-xs text-foreground">Source Wallet</Label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setSourceWallet('internal')}
              className={`p-2 rounded-lg border-2 transition-all ${
                sourceWallet === 'internal'
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <Wallet className="h-3 w-3 text-foreground" />
                <span className="font-medium text-xs text-foreground">Internal</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {internalWalletAddress ? (
                  <>
                    <div className="truncate text-[10px]">{internalWalletAddress.slice(0,6)}...{internalWalletAddress.slice(-4)}</div>
                    <div className="font-medium text-foreground mt-0.5">
                      {sourceBalance.toFixed(2)} USDC
                    </div>
                  </>
                ) : (
                  'No wallet'
                )}
              </div>
            </button>

            <button
              onClick={() => setSourceWallet('external')}
              className={`p-2 rounded-lg border-2 transition-all ${
                sourceWallet === 'external'
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <Wallet className="h-3 w-3 text-foreground" />
                <span className="font-medium text-xs text-foreground">External</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {wallet.isConnected ? (
                  <>
                    <div className="truncate text-[10px]">{wallet.address?.slice(0,6)}...{wallet.address?.slice(-4)}</div>
                    <div className="font-medium text-foreground mt-0.5">
                      {sourceBalance.toFixed(2)} USDC
                    </div>
                  </>
                ) : (
                  'Not connected'
                )}
              </div>
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-foreground">Source Chain</Label>
          <Select value={sourceChain} onValueChange={setSourceChain}>
            <SelectTrigger className="bg-background border-border text-foreground h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_BRIDGE_CHAINS.map(chain => (
                <SelectItem key={chain.id} value={chain.id}>
                  <div className="flex items-center gap-2">
                    {chain.iconUrl ? (
                      <img src={chain.iconUrl} alt={chain.name} className="h-4 w-4 rounded-full" />
                    ) : (
                      <span className="text-sm">{chain.icon}</span>
                    )}
                    <span className="text-xs">{chain.name}</span>
                    {(chain.id === 'base' || chain.id === 'arbitrum') && (
                      <Badge variant="default" className="text-[10px] px-1 py-0">Low Gas</Badge>
                    )}
                    {chain.id === 'ethereum' && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">High Gas</Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {balances.find(b => b.asset === 'USDC' && b.chain === chain.id)?.amount.toFixed(2) || '0.00'} USDC
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-foreground">Bridge Provider</Label>
          <Select value={bridgeProvider} onValueChange={setBridgeProvider}>
            <SelectTrigger className="bg-background border-border text-foreground h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableProviders.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">{provider.name}</span>
                      {provider.recommended && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">Fastest</Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {provider.speed} • {provider.fees}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProvider && (
            <p className="text-xs text-muted-foreground">
              {selectedProvider.description}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-foreground">Amount (USDC)</Label>
            <button
              onClick={() => setAmount(sourceBalance.toString())}
              className="text-[10px] text-primary hover:underline"
            >
              Max: {sourceBalance.toFixed(2)}
            </button>
          </div>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bg-background border-border text-foreground h-8 text-xs"
          />
        </div>

        {quoteLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Getting quote...
          </div>
        )}

        {quote && !quoteLoading && (
          <>
            {/* Check if quote matches current input */}
            {parseFloat(amount || '0') !== quote.inputAmount ? (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Updating quote...</span>
              </div>
            ) : (
              <>
                {/* Sanity Check Warning */}
                {quote.estimatedOutput < quote.inputAmount * 0.99 && (
                  <Alert className="bg-destructive/10 border-destructive/20 py-2">
                    <AlertCircle className="h-3 w-3 text-destructive" />
                    <AlertDescription className="text-xs text-destructive">
                      <strong>ERROR:</strong> Fee calculation issue detected. Expected output: ${(quote.inputAmount * 0.997).toFixed(2)}, got: ${quote.estimatedOutput.toFixed(2)}. DO NOT PROCEED. Contact support.
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="p-2 bg-background rounded-lg border border-border space-y-0.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Quote for: {quote.inputAmount.toFixed(2)} USDC</span>
                    <span>Est. Time: {quote.estimatedTime}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Input Amount</span>
                    <span className="text-foreground font-medium">${quote.inputAmount.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Bridge Fee ({(quote.fee / quote.inputAmount * 100).toFixed(2)}%)</span>
                    <span className="text-destructive">-${quote.fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{selectedChain?.name} Gas</span>
                    <span className="text-muted-foreground">
                      {sourceChain === 'ethereum' ? '$5 - $30 (est)' : 
                       sourceChain === 'arbitrum' ? '$0.10 - $0.50 (est)' :
                       sourceChain === 'base' ? '$0.05 - $0.30 (est)' :
                       sourceChain === 'optimism' ? '$0.10 - $0.50 (est)' :
                       sourceChain === 'polygon' ? '$0.50 - $2 (est)' :
                       sourceChain === 'bsc' ? '$0.30 - $1 (est)' :
                       sourceChain === 'avalanche' ? '$1 - $3 (est)' :
                       sourceChain === 'solana' ? '$0.01 - $0.05 (est)' :
                       '$0.50 - $5 (est)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-border pt-0.5 mt-0.5">
                    <span className="text-muted-foreground">Total Cost</span>
                    <span className="text-foreground font-medium">${quote.fee.toFixed(2)} + gas</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-border pt-0.5 mt-0.5">
                    <span className="text-foreground font-medium">You'll Receive</span>
                    <span className="text-foreground font-bold">${quote.estimatedOutput.toFixed(2)} USDC</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <Button 
          onClick={() => setStep('review')} 
          disabled={!quote || quoteLoading || !amount || parseFloat(amount) <= 0}
          className="w-full h-8 text-xs"
        >
          Review Bridge
        </Button>

        <Alert className="bg-muted/50 border-border py-1.5">
          <AlertCircle className="h-3 w-3 text-muted-foreground" />
          <AlertDescription className="text-muted-foreground text-[10px] leading-relaxed">
            Ensure you have {selectedChain?.symbol} for gas fees on {selectedChain?.name}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};