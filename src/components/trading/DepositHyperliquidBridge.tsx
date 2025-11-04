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
    bridgeStatus 
  } = useHyperliquidBridge();

  const selectedChain = SUPPORTED_BRIDGE_CHAINS.find(c => c.id === sourceChain);
  const selectedProvider = BRIDGE_PROVIDERS.find(p => p.id === bridgeProvider);

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
        getQuote({
          fromChain: sourceChain,
          toChain: 'hyperliquid',
          token: 'USDC',
          amount: parseFloat(amount),
          provider: bridgeProvider,
          destinationAddress: hyperliquidAddress,
          sourceWalletAddress: sourceAddress
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [amount, sourceChain, bridgeProvider, hyperliquidAddress, sourceWallet, wallet.address, internalWalletAddress, getQuote]);

  const handleBridge = async () => {
    if (!quote) return;

    // Validate password for internal wallet
    if (sourceWallet === 'internal' && !password) {
      toast({
        variant: "destructive",
        title: "Password Required",
        description: "Please enter your wallet password"
      });
      return;
    }

    setStep('processing');
    try {
      const sourceAddress = sourceWallet === 'external' ? wallet.address : internalWalletAddress;
      await executeBridge(quote, sourceAddress, sourceWallet, password || undefined);
      setStep('complete');
      toast({
        title: "Bridge Initiated",
        description: `Bridging ${amount} USDC from ${sourceChain} to Hyperliquid L1`,
      });
      onSuccess?.();
    } catch (error) {
      setStep('input');
      toast({
        title: "Bridge Failed",
        description: error instanceof Error ? error.message : "Failed to execute bridge",
        variant: "destructive"
      });
    }
  };

  if (step === 'complete') {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-status-success" />
            <CardTitle className="text-foreground">Bridge Complete</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Funds will arrive in your Hyperliquid wallet shortly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bridgeStatus && (
            <div className="p-4 bg-background rounded-lg border border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-foreground font-medium">{bridgeStatus.amount} USDC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction Hash</span>
                <span className="text-foreground font-mono text-xs">{bridgeStatus.txHash?.slice(0, 10)}...</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="default">Processing</Badge>
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
        <CardHeader>
          <CardTitle className="text-foreground">Processing Bridge</CardTitle>
          <CardDescription className="text-muted-foreground">
            {sourceWallet === 'internal' ? 'Signing transaction...' : 'Please confirm the transaction in your wallet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Waiting for confirmation...</p>
        </CardContent>
      </Card>
    );
  }

  if (step === 'review' && quote) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Review Bridge</CardTitle>
          <CardDescription className="text-muted-foreground">
            Confirm the details before proceeding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{selectedChain?.icon}</div>
              <div>
                <p className="text-sm font-medium text-foreground">{selectedChain?.name}</p>
                <p className="text-xs text-muted-foreground">{amount} USDC</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center gap-3">
              <div className="text-2xl">🔵</div>
              <div>
                <p className="text-sm font-medium text-foreground">Hyperliquid</p>
                <p className="text-xs text-muted-foreground">{quote.estimatedOutput.toFixed(2)} USDC</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 p-4 bg-background rounded-lg border border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Source Wallet</span>
              <span className="text-foreground font-medium capitalize">{sourceWallet}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bridge Provider</span>
              <span className="text-foreground font-medium">{selectedProvider?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Estimated Time
              </span>
              <span className="text-foreground">{quote.estimatedTime}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Bridge Fee
              </span>
              <span className="text-foreground">${quote.fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
              <span className="text-foreground font-medium">You'll Receive</span>
              <span className="text-foreground font-bold">{quote.estimatedOutput.toFixed(2)} USDC</span>
            </div>
          </div>

          <Alert className="bg-primary/10 border-primary/20">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-foreground">
              <strong>Bridging to Hyperliquid L1</strong> - Funds will arrive at: <span className="font-mono text-xs">{hyperliquidAddress.slice(0,6)}...{hyperliquidAddress.slice(-4)}</span>
            </AlertDescription>
          </Alert>

          {sourceWallet === 'internal' && (
            <div className="space-y-2">
              <Label className="text-foreground">Wallet Password</Label>
              <Input
                type="password"
                placeholder="Enter wallet password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('input')} className="flex-1">
              Back
            </Button>
            <Button onClick={handleBridge} className="flex-1" disabled={sourceWallet === 'internal' && !password}>
              Confirm Bridge
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sourceBalance = getSourceBalance();

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Bridge to Hyperliquid L1</CardTitle>
        <CardDescription className="text-muted-foreground">
          Deposit USDC from any supported blockchain to Hyperliquid's native L1
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-primary/10 border-primary/20">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground text-sm">
            <strong>Hyperliquid L1</strong> - Trading wallet: {hyperliquidAddress.slice(0,6)}...{hyperliquidAddress.slice(-4)}
          </AlertDescription>
        </Alert>

        {/* Source Wallet Selection */}
        <div className="space-y-2">
          <Label className="text-foreground">Source Wallet</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSourceWallet('internal')}
              className={`p-4 rounded-lg border-2 transition-all ${
                sourceWallet === 'internal'
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-foreground" />
                <span className="font-medium text-foreground">Internal</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {internalWalletAddress ? (
                  <>
                    <div className="truncate">{internalWalletAddress.slice(0,6)}...{internalWalletAddress.slice(-4)}</div>
                    <div className="font-medium text-foreground mt-1">
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
              className={`p-4 rounded-lg border-2 transition-all ${
                sourceWallet === 'external'
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-foreground" />
                <span className="font-medium text-foreground">External</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {wallet.isConnected ? (
                  <>
                    <div className="truncate">{wallet.address?.slice(0,6)}...{wallet.address?.slice(-4)}</div>
                    <div className="font-medium text-foreground mt-1">
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

        <div className="space-y-2">
          <Label className="text-foreground">Source Chain</Label>
          <Select value={sourceChain} onValueChange={setSourceChain}>
            <SelectTrigger className="bg-background border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_BRIDGE_CHAINS.map(chain => (
                <SelectItem key={chain.id} value={chain.id}>
                  <div className="flex items-center gap-2">
                    {chain.iconUrl ? (
                      <img src={chain.iconUrl} alt={chain.name} className="h-4 w-4 rounded-full" />
                    ) : (
                      <span>{chain.icon}</span>
                    )}
                    <span>{chain.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {balances.find(b => b.asset === 'USDC' && b.chain === chain.id)?.amount.toFixed(2) || '0.00'} USDC
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Bridge Provider</Label>
          <Select value={bridgeProvider} onValueChange={setBridgeProvider}>
            <SelectTrigger className="bg-background border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BRIDGE_PROVIDERS.filter(p => p.supportedChains.includes(sourceChain)).map(provider => (
                <SelectItem key={provider.id} value={provider.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{provider.name}</span>
                    {provider.recommended && <Badge variant="default" className="ml-2">Recommended</Badge>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProvider && (
            <p className="text-xs text-muted-foreground">
              {selectedProvider.speed} • {selectedProvider.fees} fee
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground">Amount (USDC)</Label>
            <span className="text-xs text-muted-foreground">
              Available: {sourceBalance.toFixed(2)} USDC
            </span>
          </div>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bg-background border-border text-foreground"
          />
          <button
            onClick={() => setAmount(sourceBalance.toString())}
            className="text-xs text-primary hover:underline"
          >
            Use Max
          </button>
        </div>

        {quoteLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Getting quote...
          </div>
        )}

        {quote && !quoteLoading && (
          <div className="p-3 bg-background rounded-lg border border-border space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">You'll Receive</span>
              <span className="text-foreground font-medium">{quote.estimatedOutput.toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Est. Time: {quote.estimatedTime}</span>
              <span>Fee: ${quote.fee.toFixed(2)}</span>
            </div>
          </div>
        )}

        <Button 
          onClick={() => setStep('review')} 
          disabled={!quote || quoteLoading || !amount || parseFloat(amount) <= 0}
          className="w-full"
        >
          Review Bridge
        </Button>

        <Alert className="bg-muted/50 border-border">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="text-muted-foreground text-xs">
            Make sure you have {selectedChain?.symbol} for gas fees on {selectedChain?.name}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};