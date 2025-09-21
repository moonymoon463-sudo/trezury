import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingDown, DollarSign } from "lucide-react";
import { Chain, Token, CHAIN_CONFIGS } from "@/types/lending";
import { LendingWalletService } from "@/services/lendingWalletService";
import { useToast } from "@/hooks/use-toast";
import { HealthFactorIndicator } from "./HealthFactorIndicator";

export function LendingBorrow() {
  const { toast } = useToast();
  const [selectedChain, setSelectedChain] = useState<Chain>('ethereum');
  const [selectedToken, setSelectedToken] = useState<Token>('USDC');
  const [amount, setAmount] = useState('');
  const [rateType, setRateType] = useState<'variable' | 'stable'>('variable');
  const [currentAPY, setCurrentAPY] = useState(0);
  const [healthFactor, setHealthFactor] = useState(2.1);
  const [borrowingPower, setBorrowingPower] = useState(8450);
  const [loading, setLoading] = useState(false);

  const selectedChainConfig = CHAIN_CONFIGS[selectedChain];

  // Update borrowing APY when chain, token, or rate type changes
  useEffect(() => {
    const updateAPY = async () => {
      if (selectedChain && selectedToken) {
        // Simulate variable vs stable borrowing rates
        const baseRate = selectedToken === 'USDC' ? 5.2 : 
                         selectedToken === 'USDT' ? 4.8 :
                         selectedToken === 'DAI' ? 4.5 :
                         selectedToken === 'XAUT' ? 6.1 :
                         selectedToken === 'AURU' ? 12.7 : 5.0;
        
        const adjustedRate = rateType === 'stable' ? baseRate + 1.5 : baseRate;
        setCurrentAPY(adjustedRate);
      }
    };
    updateAPY();
  }, [selectedChain, selectedToken, rateType]);

  // Reset token when chain changes
  useEffect(() => {
    const supportedTokens = LendingWalletService.getSupportedTokens(selectedChain);
    if (supportedTokens.length > 0 && !supportedTokens.includes(selectedToken)) {
      setSelectedToken(supportedTokens[0]);
    }
  }, [selectedChain, selectedToken]);

  // Calculate new health factor based on borrowing amount
  const calculateNewHealthFactor = () => {
    if (!amount || parseFloat(amount) <= 0) return healthFactor;
    
    const borrowAmount = parseFloat(amount);
    const currentBorrow = 2550; // Mock current borrowed amount
    const newTotalBorrow = currentBorrow + borrowAmount;
    const collateralValue = 10000; // Mock collateral value
    
    // Simple health factor calculation: collateral / borrowed
    const newHealthFactor = (collateralValue * 0.8) / newTotalBorrow; // 80% LTV
    return Math.max(0.1, newHealthFactor);
  };

  const newHealthFactor = calculateNewHealthFactor();
  const isHealthy = newHealthFactor > 1.2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    if (newHealthFactor < 1.1) {
      toast({
        variant: "destructive",
        title: "Health Factor Too Low",
        description: "This borrow would put your position at risk of liquidation"
      });
      return;
    }

    setLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      toast({
        title: "Borrow Successful",
        description: `Borrowed ${amount} ${selectedToken} at ${currentAPY.toFixed(2)}% ${rateType} APY`
      });
      
      setAmount('');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Borrow Failed",
        description: "Unable to complete borrow transaction"
      });
    } finally {
      setLoading(false);
    }
  };

  // Get supported tokens for selected chain
  const supportedTokens = LendingWalletService.getSupportedTokens(selectedChain);
  const availableTokenConfigs = selectedChainConfig.tokens.filter(
    token => supportedTokens.includes(token.symbol)
  );

  const borrowAmount = parseFloat(amount) || 0;
  const maxBorrowable = borrowingPower * 0.9; // 90% of borrowing power for safety

  return (
    <Card className="w-full max-w-2xl mx-auto bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <TrendingDown className="h-5 w-5 text-destructive" />
          Borrow Assets
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Borrow assets against your collateral at variable or stable rates.
        </CardDescription>
      </CardHeader>
    
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Health Factor Warning */}
          <HealthFactorIndicator 
            current={healthFactor} 
            projected={newHealthFactor}
            showProjected={borrowAmount > 0}
          />

          {/* Borrowing Power */}
          <div className="bg-surface-elevated rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Available to Borrow</span>
              <span className="text-lg font-bold text-foreground">${borrowingPower.toLocaleString()}</span>
            </div>
            <Progress 
              value={((borrowingPower - maxBorrowable + borrowAmount) / borrowingPower) * 100} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Based on your collateral and health factor
            </p>
          </div>

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
            <Label htmlFor="token" className="text-foreground">Asset to Borrow</Label>
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
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount" className="text-foreground">Amount</Label>
              <Button 
                type="button" 
                variant="link" 
                size="sm" 
                onClick={() => setAmount((maxBorrowable).toString())}
                className="h-auto p-0 text-primary"
              >
                Max: ${maxBorrowable.toFixed(0)}
              </Button>
            </div>
            <Input
              id="amount"
              type="number"
              step="0.000001"
              min="0"
              max={maxBorrowable}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="bg-surface-elevated border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Rate Type Selection */}
          <div className="space-y-3">
            <Label className="text-foreground">Interest Rate Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={rateType === 'variable' ? "default" : "outline"}
                className="flex flex-col items-center p-4 h-auto"
                onClick={() => setRateType('variable')}
              >
                <span className="font-medium">Variable</span>
                <span className="text-sm opacity-70">{currentAPY.toFixed(2)}% APY</span>
              </Button>
              <Button
                type="button"
                variant={rateType === 'stable' ? "default" : "outline"}
                className="flex flex-col items-center p-4 h-auto"
                onClick={() => setRateType('stable')}
              >
                <span className="font-medium">Stable</span>
                <span className="text-sm opacity-70">{(currentAPY + 1.5).toFixed(2)}% APY</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Variable rates change with market conditions. Stable rates remain fixed.
            </p>
          </div>

          {/* Risk Warning */}
          <div className="bg-card border border-destructive/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-destructive">
                  Liquidation Risk
                </p>
                <ul className="space-y-1 text-card-foreground">
                  <li>• Maintain health factor above 1.0 to avoid liquidation</li>
                  <li>• Collateral value changes affect your health factor</li>
                  <li>• Interest accrues continuously on borrowed amounts</li>
                  <li>• Liquidation penalty: up to 12.5% of collateral</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full font-bold" 
            size="lg"
            disabled={!amount || parseFloat(amount) <= 0 || loading || !isHealthy || borrowAmount > maxBorrowable}
          >
            {loading ? (
              "Processing Borrow..."
            ) : !isHealthy ? (
              "Health Factor Too Low"
            ) : borrowAmount > maxBorrowable ? (
              "Amount Exceeds Borrowing Power"
            ) : (
              `Borrow ${amount || '0'} ${selectedToken}`
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}