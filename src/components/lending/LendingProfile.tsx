import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, CreditCard, Shield, AlertTriangle, DollarSign, Plus, Activity, Target, BarChart3, ArrowUpRight } from "lucide-react";
import { useValidatedLending } from "@/hooks/useValidatedLending";
import { AaveStyleLendingService } from "@/services/aaveStyleLendingService";
import { HealthFactorIndicator } from "@/components/lending/HealthFactorIndicator";
import { ValidationStatus } from "@/components/testing/ValidationStatus";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

function SupplyPositionCard({ supply, onWithdraw, onToggleCollateral }: {
  supply: any;
  onWithdraw: (asset: string, amount: number) => void;
  onToggleCollateral: (asset: string, useAsCollateral: boolean) => void;
}) {
  const supplyRate = AaveStyleLendingService.formatAPY(supply.supply_rate_at_deposit);
  const totalSupplied = AaveStyleLendingService.formatAmount(supply.supplied_amount_dec + supply.accrued_interest_dec, supply.asset);
  const navigate = useNavigate();
  
  const getTokenIcon = (token: string) => {
    const iconMap: { [key: string]: string } = {
      USDC: "linear-gradient(135deg, #2775ca 0%, #1e40af 100%)",
      USDT: "linear-gradient(135deg, #50af95 0%, #07927b 100%)",
      DAI: "linear-gradient(135deg, #f4b731 0%, #e48806 100%)",
      XAUT: "linear-gradient(135deg, #ffd700 0%, #b8860b 100%)",
      AURU: "linear-gradient(135deg, #ffa726 0%, #f57c00 100%)"
    };
    return iconMap[token] || "linear-gradient(135deg, #64748b 0%, #475569 100%)";
  };

  return (
    <Card className="bg-surface-elevated border-border hover:bg-surface-overlay transition-all duration-300 group">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
              style={{ background: getTokenIcon(supply.asset) }}
            >
              {supply.asset.slice(0, 2)}
            </div>
            <div>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                {totalSupplied} {supply.asset}
                <Badge variant="outline" className="border-muted-foreground/20 text-muted-foreground bg-muted/10">
                  {supply.chain}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {supplyRate} APY
                </Badge>
                {supply.used_as_collateral && (
                  <Badge variant="outline" className="border-green-500/20 bg-green-500/10 text-green-600">
                    <Shield className="h-3 w-3 mr-1" />
                    Collateral
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={supply.used_as_collateral}
              onCheckedChange={(checked) => onToggleCollateral(supply.asset, checked)}
            />
            <span className="text-sm text-muted-foreground">Collateral</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Principal</p>
            <p className="font-semibold text-foreground">
              {AaveStyleLendingService.formatAmount(supply.supplied_amount_dec, supply.asset)} {supply.asset}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Accrued Interest</p>
            <p className="font-semibold text-primary">
              +{AaveStyleLendingService.formatAmount(supply.accrued_interest_dec, supply.asset)} {supply.asset}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={() => onWithdraw(supply.asset, supply.supplied_amount_dec + supply.accrued_interest_dec)}
            className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <TrendingDown className="h-4 w-4 mr-1" />
            Withdraw
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/lending?tab=supply')}
            className="hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BorrowPositionCard({ borrow, onRepay }: {
  borrow: any;
  onRepay: (asset: string, amount: number, rateMode: 'variable' | 'stable') => void;
}) {
  const borrowRate = AaveStyleLendingService.formatAPY(borrow.borrow_rate_at_creation);
  const totalOwed = AaveStyleLendingService.formatAmount(borrow.borrowed_amount_dec + borrow.accrued_interest_dec, borrow.asset);
  const navigate = useNavigate();
  
  const getTokenIcon = (token: string) => {
    const iconMap: { [key: string]: string } = {
      USDC: "linear-gradient(135deg, #2775ca 0%, #1e40af 100%)",
      USDT: "linear-gradient(135deg, #50af95 0%, #07927b 100%)",
      DAI: "linear-gradient(135deg, #f4b731 0%, #e48806 100%)",
      XAUT: "linear-gradient(135deg, #ffd700 0%, #b8860b 100%)",
      AURU: "linear-gradient(135deg, #ffa726 0%, #f57c00 100%)"
    };
    return iconMap[token] || "linear-gradient(135deg, #64748b 0%, #475569 100%)";
  };

  const getRateModeColor = (mode: string) => {
    return mode === 'variable' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' : 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  };

  return (
    <Card className="bg-surface-elevated border-border hover:bg-surface-overlay transition-all duration-300 group">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
              style={{ background: getTokenIcon(borrow.asset) }}
            >
              {borrow.asset.slice(0, 2)}
            </div>
            <div>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                {totalOwed} {borrow.asset}
                <Badge variant="outline" className="border-muted-foreground/20 text-muted-foreground bg-muted/10">
                  {borrow.chain}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">
                  {borrowRate} APY
                </Badge>
                <Badge variant="outline" className={getRateModeColor(borrow.rate_mode)}>
                  {borrow.rate_mode}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Principal</p>
            <p className="font-semibold text-foreground">
              {AaveStyleLendingService.formatAmount(borrow.borrowed_amount_dec, borrow.asset)} {borrow.asset}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <p className="text-xs text-muted-foreground mb-1">Interest Owed</p>
            <p className="font-semibold text-destructive">
              +{AaveStyleLendingService.formatAmount(borrow.accrued_interest_dec, borrow.asset)} {borrow.asset}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={() => onRepay(borrow.asset, borrow.borrowed_amount_dec + borrow.accrued_interest_dec, borrow.rate_mode)}
            className="flex-1 bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70"
          >
            <CreditCard className="h-4 w-4 mr-1" />
            Repay
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/lending?tab=borrow')}
            className="hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function LendingProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    userSupplies, 
    userBorrows, 
    userHealthFactor, 
    withdraw, 
    repay, 
    setCollateral,
    loading 
  } = useValidatedLending();

  if (!user) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Please sign in to view your lending profile</p>
        </CardContent>
      </Card>
    );
  }

  const totalSuppliedUSD = userSupplies.reduce((sum, supply) => 
    sum + (supply.supplied_amount_dec + supply.accrued_interest_dec), 0);
  const totalBorrowedUSD = userBorrows.reduce((sum, borrow) => 
    sum + (borrow.borrowed_amount_dec + borrow.accrued_interest_dec), 0);

  const netWorth = totalSuppliedUSD - totalBorrowedUSD;
  const borrowUtilization = totalSuppliedUSD > 0 ? (totalBorrowedUSD / totalSuppliedUSD) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-xl border border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Lending Portfolio</h1>
            <p className="text-muted-foreground">
              Manage your DeFi positions and monitor your financial health
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Net Worth</p>
              <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-primary' : 'text-destructive'}`}>
                ${Math.abs(netWorth).toFixed(2)}
              </p>
            </div>
            <Button onClick={() => navigate('/lending?tab=supply')} className="bg-gradient-to-r from-primary to-primary/80">
              <Plus className="h-4 w-4 mr-2" />
              New Position
            </Button>
          </div>
        </div>
      </div>

      {/* Market Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-surface-elevated border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Supplied</p>
                <p className="text-xl font-bold text-foreground">${totalSuppliedUSD.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-surface-elevated border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Borrowed</p>
                <p className="text-xl font-bold text-foreground">${totalBorrowedUSD.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <BarChart3 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Borrow Utilization</p>
                <p className="text-xl font-bold text-foreground">{borrowUtilization.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Positions</p>
                <p className="text-xl font-bold text-foreground">{userSupplies.length + userBorrows.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Health Factor Display */}
      {userHealthFactor && (
        <Card className="bg-surface-elevated border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Shield className="h-5 w-5 text-primary" />
              Account Health Monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <HealthFactorIndicator current={userHealthFactor.health_factor} />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Total Collateral</p>
                <p className="text-lg font-semibold text-primary">${userHealthFactor.total_collateral_usd.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Total Debt</p>
                <p className="text-lg font-semibold text-destructive">${userHealthFactor.total_debt_usd.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Borrowing Power</p>
                <p className="text-lg font-semibold text-foreground">${userHealthFactor.available_borrow_usd.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Loan-to-Value</p>
                <p className="text-lg font-semibold text-foreground">{(userHealthFactor.ltv * 100).toFixed(1)}%</p>
              </div>
            </div>

            {borrowUtilization > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Borrowing Utilization</span>
                  <span className="font-medium">{borrowUtilization.toFixed(1)}%</span>
                </div>
                <Progress value={borrowUtilization} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="supplies" className="space-y-6">
        <TabsList className="bg-surface-elevated border border-border w-full">
          <TabsTrigger value="supplies" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground transition-all">
            <TrendingUp className="h-4 w-4 mr-2" />
            Supply Positions
            <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">{userSupplies.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="borrows" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground transition-all">
            <TrendingDown className="h-4 w-4 mr-2" />
            Borrow Positions
            <Badge variant="secondary" className="ml-2 bg-destructive/10 text-destructive">{userBorrows.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground transition-all">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supplies" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Supply Positions</h3>
            <Button onClick={() => navigate('/lending?tab=supply')} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Supply
            </Button>
          </div>
          
          {userSupplies.length === 0 ? (
            <Card className="bg-surface-elevated border-border">
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">Start Earning Interest</h3>
                  <p className="text-muted-foreground mb-6">
                    Supply assets to lending pools and earn competitive yields on your crypto holdings.
                  </p>
                  <Button onClick={() => navigate('/lending?tab=supply')} className="bg-gradient-to-r from-primary to-primary/80">
                    <Plus className="h-4 w-4 mr-2" />
                    Supply Assets
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {userSupplies.map((supply) => (
                <SupplyPositionCard
                  key={`${supply.asset}-${supply.chain}`}
                  supply={supply}
                  onWithdraw={withdraw}
                  onToggleCollateral={setCollateral}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="borrows" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Borrow Positions</h3>
            <Button onClick={() => navigate('/lending?tab=borrow')} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Borrow
            </Button>
          </div>
          
          {userBorrows.length === 0 ? (
            <Card className="bg-surface-elevated border-border">
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <CreditCard className="h-8 w-8 text-orange-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">Access Liquidity</h3>
                  <p className="text-muted-foreground mb-6">
                    Borrow against your supplied assets to access liquidity without selling your holdings.
                  </p>
                  <Button onClick={() => navigate('/lending?tab=borrow')} variant="outline" className="border-orange-500/20 text-orange-600 hover:bg-orange-500/10">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Start Borrowing
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {userBorrows.map((borrow) => (
                <BorrowPositionCard
                  key={`${borrow.asset}-${borrow.chain}-${borrow.rate_mode}`}
                  borrow={borrow}
                  onRepay={repay}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <ValidationStatus />
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-surface-elevated border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  Supply Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                    <p className="text-lg font-bold text-primary">${totalSuppliedUSD.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Positions</p>
                    <p className="text-lg font-bold text-foreground">{userSupplies.length}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Used as Collateral</span>
                    <span className="font-medium text-foreground">
                      {userSupplies.filter(s => s.used_as_collateral).length} / {userSupplies.length}
                    </span>
                  </div>
                  <Progress 
                    value={userSupplies.length > 0 ? (userSupplies.filter(s => s.used_as_collateral).length / userSupplies.length) * 100 : 0} 
                    className="h-2" 
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-surface-elevated border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  </div>
                  Borrow Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Total Debt</p>
                    <p className="text-lg font-bold text-destructive">${totalBorrowedUSD.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Positions</p>
                    <p className="text-lg font-bold text-foreground">{userBorrows.length}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Variable Rate Borrows</span>
                    <span className="font-medium text-foreground">
                      {userBorrows.filter(b => b.rate_mode === 'variable').length} / {userBorrows.length}
                    </span>
                  </div>
                  <Progress 
                    value={userBorrows.length > 0 ? (userBorrows.filter(b => b.rate_mode === 'variable').length / userBorrows.length) * 100 : 0} 
                    className="h-2" 
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Performance */}
          <Card className="bg-surface-elevated border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                Portfolio Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-sm text-muted-foreground mb-2">Net Portfolio Value</p>
                  <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    ${Math.abs(netWorth).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {netWorth >= 0 ? 'Positive' : 'Negative'} equity
                  </p>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-sm text-muted-foreground mb-2">Borrowing Efficiency</p>
                  <p className="text-2xl font-bold text-foreground">{borrowUtilization.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Capital utilization
                  </p>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-sm text-muted-foreground mb-2">Risk Level</p>
                  <p className={`text-2xl font-bold ${
                    !userHealthFactor ? 'text-muted-foreground' :
                    userHealthFactor.health_factor > 2 ? 'text-green-600' :
                    userHealthFactor.health_factor > 1.5 ? 'text-yellow-600' : 'text-destructive'
                  }`}>
                    {!userHealthFactor ? 'N/A' : 
                     userHealthFactor.health_factor > 2 ? 'Low' :
                     userHealthFactor.health_factor > 1.5 ? 'Medium' : 'High'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Liquidation risk
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Warnings */}
          {userHealthFactor && userHealthFactor.health_factor < 1.5 && (
            <Card className="bg-destructive/5 border-destructive/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Alert: Low Health Factor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    Your current health factor of {userHealthFactor.health_factor.toFixed(3)} indicates high liquidation risk.
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => navigate('/lending?tab=supply')} 
                      size="sm" 
                      className="bg-primary"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Collateral
                    </Button>
                    <Button 
                      onClick={() => navigate('/lending?tab=borrow')} 
                      size="sm" 
                      variant="outline"
                      className="border-destructive/20 text-destructive hover:bg-destructive/10"
                    >
                      <ArrowUpRight className="h-4 w-4 mr-2" />
                      Repay Debt
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}