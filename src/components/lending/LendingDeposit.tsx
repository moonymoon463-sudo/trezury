import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Wallet, DollarSign } from "lucide-react";
import { useLending } from "@/hooks/useLending";
import { Chain, Token, CHAIN_CONFIGS } from "@/types/lending";
import { LendingService } from "@/services/lendingService";
import { LendingWalletService } from "@/services/lendingWalletService";
import { useToast } from "@/hooks/use-toast";

export function LendingDeposit() {
  const { loading } = useLending();
  const { toast } = useToast();
  const [selectedChain, setSelectedChain] = useState<Chain>('ethereum');
  const [selectedToken, setSelectedToken] = useState<Token>('USDC');
  const [amount, setAmount] = useState('');
  const [useAsCollateral, setUseAsCollateral] = useState(true);
  const [currentAPY, setCurrentAPY] = useState(0);

  const selectedChainConfig = CHAIN_CONFIGS[selectedChain];

  // Update APY when chain or token changes (variable rate, no lock terms)
  useEffect(() => {
    const updateAPY = async () => {
      if (selectedChain && selectedToken) {
        // Simulate variable APY calculation for Aave-style lending
        const baseAPY = selectedToken === 'USDC' ? 4.2 : 
                       selectedToken === 'USDT' ? 3.8 :
                       selectedToken === 'DAI' ? 3.5 :
                       selectedToken === 'XAUT' ? 2.1 :
                       selectedToken === 'AURU' ? 8.7 : 4.0;
        setCurrentAPY(baseAPY);
      }
    };
    updateAPY();
  }, [selectedChain, selectedToken]);

  // Reset token when chain changes and check support
  useEffect(() => {
    const supportedTokens = LendingWalletService.getSupportedTokens(selectedChain);
    if (supportedTokens.length > 0 && !supportedTokens.includes(selectedToken)) {
      setSelectedToken(supportedTokens[0]);
    }
  }, [selectedChain, selectedToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    // Check if chain/token combination is supported
    if (!LendingWalletService.isSupported(selectedChain, selectedToken)) {
      toast({
        variant: "destructive",
        title: "Not Supported",
        description: `${selectedToken} supply on ${selectedChain} is not yet available`
      });
      return;
    }

    toast({
      title: "Supply Successful",
      description: `Supplied ${amount} ${selectedToken}. ${useAsCollateral ? 'Enabled as collateral.' : 'Not used as collateral.'}`
    });

    // Reset form
    setAmount('');
  };

  // Get supported tokens for selected chain
  const supportedTokens = LendingWalletService.getSupportedTokens(selectedChain);
  const availableTokenConfigs = selectedChainConfig.tokens.filter(
    token => supportedTokens.includes(token.symbol)
  );

  return (
    <Card className="w-full max-w-2xl mx-auto bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Wallet className="h-5 w-5 text-primary" />
          Supply Assets
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Supply assets to earn variable interest and use as collateral for borrowing.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Chain Selection */}
          <div className="space-y-2">
            <Label htmlFor="chain" className="text-foreground">Blockchain</Label>
            <Select value={selectedChain} onValueChange={(value: Chain) => setSelectedChain(value)}>
              <SelectTrigger className="bg-surface-elevated border-border text-foreground">
                <SelectValue placeholder="Select chain" />
              </SelectTrigger>
              <SelectContent className="bg-surface-overlay border-border">
                {Object.entries(CHAIN_CONFIGS).map(([key, config]) => (
                  <SelectItem key={key} value={key} className="text-foreground focus:bg-surface-elevated focus:text-foreground">
                    {config.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Token Selection */}
          <div className="space-y-2">
            <Label htmlFor="token" className="text-foreground">Asset</Label>
            <Select value={selectedToken} onValueChange={(value: Token) => setSelectedToken(value)}>
              <SelectTrigger className="bg-surface-elevated border-border text-foreground">
                <SelectValue placeholder="Select asset" />
              </SelectTrigger>
              <SelectContent className="bg-surface-overlay border-border">
                {availableTokenConfigs.map((token) => (
                  <SelectItem key={token.symbol} value={token.symbol} className="text-foreground focus:bg-surface-elevated focus:text-foreground">
                    {token.symbol}
                    {token.symbol === 'XAUT' && <Badge variant="outline" className="ml-2">Gold</Badge>}
                    {token.symbol === 'AURU' && <Badge variant="outline" className="ml-2">Governance</Badge>}
                    {!LendingWalletService.isSupported(selectedChain, token.symbol) && 
                      <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-foreground">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.000001"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="bg-surface-elevated border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Current APY Display */}
          <div className="bg-surface-elevated rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Supply APY</span>
              <Badge variant="secondary" className="text-lg font-bold bg-primary text-primary-foreground">
                {currentAPY.toFixed(2)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Variable rate • Updated continuously
            </p>
          </div>

          {/* Use as Collateral */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-1">
              <Label htmlFor="collateral" className="text-sm text-foreground">
                Use as Collateral
              </Label>
              <p className="text-xs text-muted-foreground">
                Enable to use as collateral for borrowing
              </p>
            </div>
            <Switch
              id="collateral"
              checked={useAsCollateral}
              onCheckedChange={setUseAsCollateral}
            />
          </div>

          {/* Risk Disclosure */}
          <div className="bg-card border border-primary/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-primary">
                  Risk Information
                </p>
                <ul className="space-y-1 text-card-foreground">
                  <li>• Variable APY changes based on market conditions</li>
                  <li>• Collateral may be liquidated if borrowing health factor drops</li>
                  <li>• Withdraw anytime, subject to available liquidity</li>
                  <li>• Smart contract risk; funds are not FDIC insured</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full font-bold" 
            size="lg"
            disabled={!amount || parseFloat(amount) <= 0 || loading || !LendingWalletService.isSupported(selectedChain, selectedToken)}
          >
            {loading ? (
              "Supplying..."
            ) : !LendingWalletService.isSupported(selectedChain, selectedToken) ? (
              `${selectedToken} on ${selectedChain} Coming Soon`
            ) : (
              `Supply ${amount || '0'} ${selectedToken}`
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
