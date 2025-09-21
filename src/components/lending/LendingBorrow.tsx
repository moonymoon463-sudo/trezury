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
import { useToast } from "@/hooks/use-toast";
import { HealthFactorIndicator } from "./HealthFactorIndicator";
import { useAaveStyleLending } from "@/hooks/useAaveStyleLending";

export function LendingBorrow() {
  const { toast } = useToast();
  const { 
    borrow, 
    getAssetBorrowRate, 
    getAvailableBorrowAmount,
    userHealthFactor,
    poolReserves,
    loading 
  } = useAaveStyleLending();
  
  const [selectedChain, setSelectedChain] = useState<Chain>('ethereum');
  const [selectedToken, setSelectedToken] = useState<Token>('USDC');
  const [amount, setAmount] = useState('');
  const [rateType, setRateType] = useState<'variable' | 'stable'>('variable');

  const selectedChainConfig = CHAIN_CONFIGS[selectedChain];
  const currentAPY = getAssetBorrowRate(selectedToken, rateType, selectedChain);
  const availableBorrowAmount = getAvailableBorrowAmount(selectedToken, selectedChain);
  const healthFactor = userHealthFactor?.health_factor || 0;
  const borrowingPower = userHealthFactor?.available_borrow_usd || 0;

  // Reset token when chain changes
  useEffect(() => {
    const supportedTokens = selectedChainConfig?.tokens.map(t => t.symbol) || [];
    if (supportedTokens.length > 0 && !supportedTokens.includes(selectedToken)) {
      setSelectedToken(supportedTokens[0] as Token);
    }
  }, [selectedChain, selectedToken, selectedChainConfig]);

  // Calculate new health factor based on borrowing amount
  const calculateNewHealthFactor = () => {
    if (!amount || parseFloat(amount) <= 0 || !userHealthFactor) return healthFactor;
    
    const borrowAmount = parseFloat(amount);
    const currentDebt = userHealthFactor.total_debt_usd;
    const currentCollateral = userHealthFactor.total_collateral_usd;
    const liquidationThreshold = userHealthFactor.liquidation_threshold;
    
    const newDebt = currentDebt + borrowAmount;
    return currentCollateral > 0 ? (currentCollateral * liquidationThreshold) / newDebt : 0;
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

    const borrowAmount = parseFloat(amount);
    if (borrowAmount > borrowingPower) {
      toast({
        variant: "destructive",
        title: "Insufficient Borrowing Power",
        description: "Amount exceeds your available borrowing power"
      });
      return;
    }

    await borrow(selectedToken, borrowAmount, rateType, selectedChain);
    setAmount('');
  };

  // Get supported tokens for selected chain
  const availableTokenConfigs = selectedChainConfig?.tokens || [];
  const supportedTokens = poolReserves
    .filter(r => r.chain === selectedChain && r.is_active && r.borrowing_enabled)
    .map(r => r.asset);

  const borrowAmount = parseFloat(amount) || 0;
  const maxBorrowable = Math.min(availableBorrowAmount, borrowingPower * 0.9); // 90% safety margin

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
              value={borrowingPower > 0 ? Math.min(100, (borrowAmount / borrowingPower) * 100) : 0} 
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
                    {!supportedTokens.includes(token.symbol) && 
                      <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
                    }
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
                onClick={() => setAmount(maxBorrowable.toString())}
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
                <span className="text-sm opacity-70">{(currentAPY * 100).toFixed(2)}% APY</span>
              </Button>
              <Button
                type="button"
                variant={rateType === 'stable' ? "default" : "outline"}
                className="flex flex-col items-center p-4 h-auto"
                onClick={() => setRateType('stable')}
              >
                <span className="font-medium">Stable</span>
                <span className="text-sm opacity-70">{(getAssetBorrowRate(selectedToken, 'stable', selectedChain) * 100).toFixed(2)}% APY</span>
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
            disabled={!amount || parseFloat(amount) <= 0 || loading || !isHealthy || borrowAmount > maxBorrowable || !supportedTokens.includes(selectedToken)}
          >
            {loading ? (
              "Processing Borrow..."
            ) : !supportedTokens.includes(selectedToken) ? (
              `${selectedToken} borrowing not available`
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