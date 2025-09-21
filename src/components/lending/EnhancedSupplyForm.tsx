import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Calculator, 
  TrendingUp, 
  Shield, 
  AlertTriangle, 
  Clock,
  DollarSign,
  Target,
  Activity,
  Wallet,
  Bug
} from "lucide-react";
import { useAaveStyleLending } from "@/hooks/useAaveStyleLending";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useAuth } from "@/hooks/useAuth";
import { Chain, Token, CHAIN_CONFIGS } from "@/types/lending";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WalletDebugPanel } from "@/components/WalletDebugPanel";

interface EnhancedSupplyFormProps {
  chain: Chain;
  token: Token;
  initialAPY: number;
  onBack: () => void;
}

export function EnhancedSupplyForm({ chain, token, initialAPY, onBack }: EnhancedSupplyFormProps) {
  const { supply, poolReserves, loading, walletAddress, createWallet } = useAaveStyleLending();
  const { balances, getBalance } = useWalletBalance();
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [useAsCollateral, setUseAsCollateral] = useState(true);
  const [projectionPeriod, setProjectionPeriod] = useState('1'); // months
  const [isSupplying, setIsSupplying] = useState(false);
  const [testingEdgeFunction, setTestingEdgeFunction] = useState(false);

  const chainConfig = CHAIN_CONFIGS[chain];
  const poolReserve = poolReserves.find(r => r.asset === token && r.chain === chain);
  
  // Get wallet balance for the token (convert XAUT to GOLD for display)
  const walletBalance = getBalance(token === 'XAUT' ? 'GOLD' : token);
  
  // Calculate projections
  const amountNum = parseFloat(amount) || 0;
  const monthlyRate = initialAPY / 100 / 12;
  const periods = parseInt(projectionPeriod);
  const projectedEarnings = amountNum * monthlyRate * periods;
  const projectedTotal = amountNum + projectedEarnings;

  // Calculate risk metrics
  const utilizationRate = poolReserve?.utilization_rate || 0;
  const liquidityRisk = utilizationRate > 0.8 ? 'High' : utilizationRate > 0.5 ? 'Medium' : 'Low';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 Supply form submitted');
    console.log('Form state:', {
      amount,
      amountNum,
      walletBalance,
      token,
      chain,
      userAuthenticated: !!user,
      internalWallet: walletAddress
    });
    
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid amount to supply"
      });
      return;
    }

    if (parseFloat(amount) > walletBalance) {
      toast({
        variant: "destructive",
        title: "Insufficient Balance",
        description: `You only have ${walletBalance.toFixed(6)} ${token === 'XAUT' ? 'GOLD' : token} in your wallet`
      });
      return;
    }

    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to continue"
      });
      return;
    }

    if (!walletAddress) {
      toast({
        variant: "destructive",
        title: "Internal Wallet Required",
        description: "Please create your internal wallet first"
      });
      return;
    }

    if (!poolReserve?.is_active) {
      toast({
        variant: "destructive",
        title: "Market Inactive",
        description: "This market is currently inactive"
      });
      return;
    }

    try {
      console.log('✅ All validations passed, calling supply...');
      await supply(token, amountNum, chain);
      setAmount('');
      console.log('✅ Supply completed successfully');
    } catch (error) {
      console.error('❌ Supply failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Supply {token}</h2>
          <p className="text-muted-foreground">
            Supply to {chainConfig.displayName} • {initialAPY.toFixed(2)}% APY
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Supply Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Amount Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="amount" className="text-foreground">Amount to Supply</Label>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wallet className="h-4 w-4" />
                      <span>Balance: {walletBalance.toFixed(6)} {token === 'XAUT' ? 'GOLD' : token}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-primary hover:text-primary"
                        onClick={() => setAmount(walletBalance.toString())}
                      >
                        Max
                      </Button>
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      step="0.000001"
                      min="0"
                      max={walletBalance}
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="pr-16 bg-surface-elevated border-border text-foreground text-lg font-medium"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                      {token === 'XAUT' ? 'GOLD' : token}
                    </div>
                  </div>
                  {parseFloat(amount) > walletBalance && (
                    <p className="text-sm text-destructive">
                      Insufficient balance. You have {walletBalance.toFixed(6)} {token === 'XAUT' ? 'GOLD' : token} available.
                    </p>
                  )}
                </div>

                {/* Current Market Info */}
                <div className="bg-surface-elevated rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Current Supply APY</span>
                    <Badge className="text-lg font-bold bg-primary text-primary-foreground">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      {initialAPY.toFixed(2)}%
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Available Liquidity</span>
                    <span className="font-medium text-foreground">
                      ${(poolReserve?.available_liquidity_dec || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Utilization Rate</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {((poolReserve?.utilization_rate || 0) * 100).toFixed(1)}%
                      </span>
                      <Progress 
                        value={(poolReserve?.utilization_rate || 0) * 100} 
                        className="w-16 h-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Collateral Setting */}
                <div className="bg-surface-elevated rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <Label htmlFor="collateral" className="text-foreground font-medium">
                          Use as Collateral
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Enable to use this asset as collateral for borrowing
                      </p>
                    </div>
                    <Switch
                      id="collateral"
                      checked={useAsCollateral}
                      onCheckedChange={setUseAsCollateral}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full font-bold" 
                  size="lg"
                  disabled={!amount || parseFloat(amount) <= 0 || loading || !poolReserve?.is_active || !user || !walletAddress || parseFloat(amount) > walletBalance}
                >
                  {loading ? (
                    "Supplying..."
                  ) : !user ? (
                    "Please Sign In"
                  ) : !walletAddress ? (
                    "Setup Internal Wallet"
                  ) : !poolReserve?.is_active ? (
                    "Market Unavailable"
                  ) : parseFloat(amount) > walletBalance ? (
                    "Insufficient Balance"
                  ) : (
                    `Supply ${amount || '0'} ${token}`
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Projections & Info */}
        <div className="space-y-6">
          {/* Earnings Calculator */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="h-4 w-4 text-primary" />
                Earnings Projection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Projection Period (months)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {['1', '6', '12'].map((period) => (
                    <Button
                      key={period}
                      variant={projectionPeriod === period ? "default" : "outline"}
                      size="sm"
                      onClick={() => setProjectionPeriod(period)}
                      className="text-xs"
                    >
                      {period}m
                    </Button>
                  ))}
                </div>
              </div>

              {amountNum > 0 && (
                <div className="space-y-3 pt-2">
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Principal</span>
                      <span className="font-medium">{amountNum.toFixed(4)} {token}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Earnings</span>
                      <span className="font-medium text-primary">
                        +{projectedEarnings.toFixed(4)} {token}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-foreground">Total After {projectionPeriod}m</span>
                      <span className="text-foreground">{projectedTotal.toFixed(4)} {token}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" />
                Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Asset Risk</span>
                <Badge variant="outline" className="text-xs">
                  {getAssetRisk(token)}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Liquidity Risk</span>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getLiquidityRiskColor(liquidityRisk)}`}
                >
                  {liquidityRisk}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Smart Contract</span>
                <Badge variant="outline" className="text-xs">
                  Audited
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Market Activity */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Market Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Supplied</span>
                <span className="font-medium">
                  ${(poolReserve?.total_supply_dec || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Borrowed</span>
                <span className="font-medium">
                  ${(poolReserve?.total_borrowed_dec || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Supply</span>
                <span className="font-medium">
                  ${(poolReserve?.total_supply_dec || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Important Notice */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-primary">Important Notice</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• APY rates are variable and change with market conditions</li>
                    <li>• Funds are subject to smart contract risk</li>
                    <li>• Withdrawals depend on available liquidity</li>
                    <li>• Assets used as collateral may be liquidated</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function getAssetRisk(token: Token): string {
  const riskMap: Record<Token, string> = {
    USDC: 'Low',
    USDT: 'Low', 
    DAI: 'Low',
    XAUT: 'Medium',
    AURU: 'High'
  };
  return riskMap[token] || 'Medium';
}

function getLiquidityRiskColor(risk: string): string {
  switch (risk) {
    case 'Low': return 'text-green-600 border-green-200';
    case 'Medium': return 'text-yellow-600 border-yellow-200';
    case 'High': return 'text-red-600 border-red-200';
    default: return '';
  }
}