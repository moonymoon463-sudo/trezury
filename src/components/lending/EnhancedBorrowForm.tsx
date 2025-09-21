import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, TrendingDown, AlertTriangle, Calculator, DollarSign } from "lucide-react";
import { Chain, Token, CHAIN_CONFIGS } from "@/types/lending";
import { useToast } from "@/hooks/use-toast";
import { HealthFactorIndicator } from "./HealthFactorIndicator";
import { useAaveStyleLending } from "@/hooks/useAaveStyleLending";

interface EnhancedBorrowFormProps {
  chain: Chain;
  token: Token;
  variableRate: number;
  stableRate: number;
  onBack: () => void;
}

export function EnhancedBorrowForm({ 
  chain, 
  token, 
  variableRate, 
  stableRate, 
  onBack 
}: EnhancedBorrowFormProps) {
  const { toast } = useToast();
  const { 
    borrow, 
    getAvailableBorrowAmount,
    userHealthFactor,
    loading 
  } = useAaveStyleLending();
  
  const [amount, setAmount] = useState('');
  const [rateType, setRateType] = useState<'variable' | 'stable'>('variable');
  const [timeframe, setTimeframe] = useState<'1m' | '3m' | '6m' | '1y'>('1y');

  const chainConfig = CHAIN_CONFIGS[chain];
  const availableBorrowAmount = getAvailableBorrowAmount(token, chain);
  const healthFactor = userHealthFactor?.health_factor || 0;
  const borrowingPower = userHealthFactor?.available_borrow_usd || 0;

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
  const borrowAmount = parseFloat(amount) || 0;
  const maxBorrowable = Math.min(availableBorrowAmount, borrowingPower * 0.9);
  const currentRate = rateType === 'variable' ? variableRate : stableRate;

  // Calculate projected costs
  const calculateProjectedCost = () => {
    if (!borrowAmount) return { interest: 0, total: 0 };
    
    const periods = {
      '1m': 1/12,
      '3m': 3/12,
      '6m': 6/12,
      '1y': 1
    };
    
    const interest = borrowAmount * (currentRate / 100) * periods[timeframe];
    return {
      interest,
      total: borrowAmount + interest
    };
  };

  const { interest, total } = calculateProjectedCost();

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

    if (borrowAmount > borrowingPower) {
      toast({
        variant: "destructive",
        title: "Insufficient Borrowing Power",
        description: "Amount exceeds your available borrowing power"
      });
      return;
    }

    await borrow(token, borrowAmount, rateType, chain);
    setAmount('');
    onBack();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Borrow {token}</h2>
          <p className="text-muted-foreground">on {chainConfig.displayName}</p>
        </div>
      </div>

      <Card className="bg-surface-elevated border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <TrendingDown className="h-5 w-5 text-destructive" />
            Borrow Details
          </CardTitle>
        </CardHeader>
    
        <CardContent className="space-y-6">
          {/* Health Factor Warning */}
          <HealthFactorIndicator 
            current={healthFactor} 
            projected={newHealthFactor}
            showProjected={borrowAmount > 0}
          />

          {/* Borrowing Power */}
          <div className="bg-surface-overlay rounded-lg p-4">
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

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount" className="text-foreground">Borrow Amount</Label>
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
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                className="pl-10 bg-surface-overlay border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Rate Type Selection */}
          <div className="space-y-3">
            <Label className="text-foreground">Interest Rate Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <Card 
                className={`cursor-pointer transition-all ${
                  rateType === 'variable' 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'bg-surface-overlay hover:bg-surface-elevated'
                }`}
                onClick={() => setRateType('variable')}
              >
                <CardContent className="p-4 text-center">
                  <p className="font-medium text-foreground">Variable Rate</p>
                  <p className="text-2xl font-bold text-green-500">{variableRate.toFixed(2)}%</p>
                  <p className="text-xs text-muted-foreground">Changes with market</p>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-all ${
                  rateType === 'stable' 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'bg-surface-overlay hover:bg-surface-elevated'
                }`}
                onClick={() => setRateType('stable')}
              >
                <CardContent className="p-4 text-center">
                  <p className="font-medium text-foreground">Stable Rate</p>
                  <p className="text-2xl font-bold text-yellow-500">{stableRate.toFixed(2)}%</p>
                  <p className="text-xs text-muted-foreground">Fixed rate</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Cost Calculator */}
          {borrowAmount > 0 && (
            <div className="bg-surface-overlay rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">Cost Projection</span>
              </div>
              
              <div className="flex gap-2 mb-3">
                {(['1m', '3m', '6m', '1y'] as const).map((period) => (
                  <Button
                    key={period}
                    variant={timeframe === period ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeframe(period)}
                    className="flex-1"
                  >
                    {period}
                  </Button>
                ))}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Principal:</span>
                  <span className="text-foreground">${borrowAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interest ({timeframe}):</span>
                  <span className="text-foreground">${interest.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t border-border">
                  <span className="text-foreground">Total to Repay:</span>
                  <span className="text-foreground">${total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Risk Warning */}
          <div className="bg-card border border-destructive/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-destructive">Liquidation Risk</p>
                <ul className="space-y-1 text-card-foreground">
                  <li>• Keep health factor above 1.0 to avoid liquidation</li>
                  <li>• Interest accrues continuously on borrowed amounts</li>
                  <li>• Collateral value changes affect your position</li>
                  <li>• Liquidation penalty: up to 12.5% of collateral</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            onClick={handleSubmit}
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
              `Borrow ${amount || '0'} ${token}`
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}