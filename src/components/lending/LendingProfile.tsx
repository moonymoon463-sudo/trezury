import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, CreditCard, Shield, AlertTriangle } from "lucide-react";
import { useAaveStyleLending } from "@/hooks/useAaveStyleLending";
import { AaveStyleLendingService } from "@/services/aaveStyleLendingService";
import { HealthFactorIndicator } from "@/components/lending/HealthFactorIndicator";
import { useAuth } from "@/hooks/useAuth";

function SupplyPositionCard({ supply, onWithdraw, onToggleCollateral }: {
  supply: any;
  onWithdraw: (asset: string, amount: number) => void;
  onToggleCollateral: (asset: string, useAsCollateral: boolean) => void;
}) {
  const supplyRate = AaveStyleLendingService.formatAPY(supply.supply_rate_at_deposit);
  const totalSupplied = AaveStyleLendingService.formatAmount(supply.supplied_amount_dec + supply.accrued_interest_dec, supply.asset);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg text-foreground">{totalSupplied} {supply.asset}</CardTitle>
            <Badge variant="outline" className="border-muted text-muted-foreground">{supply.chain}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={supply.used_as_collateral}
              onCheckedChange={(checked) => onToggleCollateral(supply.asset, checked)}
            />
            <span className="text-sm text-muted-foreground">Collateral</span>
          </div>
        </div>
        <CardDescription className="text-muted-foreground">
          Supply APY: {supplyRate} • Earning interest since {new Date(supply.created_at).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Principal</p>
            <p className="font-medium text-foreground">
              {AaveStyleLendingService.formatAmount(supply.supplied_amount_dec, supply.asset)} {supply.asset}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Accrued Interest</p>
            <p className="font-medium text-primary">
              +{AaveStyleLendingService.formatAmount(supply.accrued_interest_dec, supply.asset)} {supply.asset}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={() => onWithdraw(supply.asset, supply.supplied_amount_dec + supply.accrued_interest_dec)}
            className="flex-1"
          >
            <TrendingDown className="h-4 w-4 mr-1" />
            Withdraw
          </Button>
          {supply.used_as_collateral && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              Used as collateral
            </div>
          )}
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

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg text-foreground">{totalOwed} {borrow.asset}</CardTitle>
            <Badge variant="outline" className="border-muted text-muted-foreground">{borrow.chain}</Badge>
          </div>
          <Badge variant="secondary">{borrow.rate_mode}</Badge>
        </div>
        <CardDescription className="text-muted-foreground">
          Borrow APY: {borrowRate} • Borrowed since {new Date(borrow.created_at).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Principal</p>
            <p className="font-medium text-foreground">
              {AaveStyleLendingService.formatAmount(borrow.borrowed_amount_dec, borrow.asset)} {borrow.asset}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Interest Owed</p>
            <p className="font-medium text-destructive">
              +{AaveStyleLendingService.formatAmount(borrow.accrued_interest_dec, borrow.asset)} {borrow.asset}
            </p>
          </div>
        </div>

        <Button 
          onClick={() => onRepay(borrow.asset, borrow.borrowed_amount_dec + borrow.accrued_interest_dec, borrow.rate_mode)}
          className="w-full"
        >
          <CreditCard className="h-4 w-4 mr-1" />
          Repay
        </Button>
      </CardContent>
    </Card>
  );
}

export function LendingProfile() {
  const { user } = useAuth();
  const { 
    userSupplies, 
    userBorrows, 
    userHealthFactor, 
    withdraw, 
    repay, 
    setCollateral,
    loading 
  } = useAaveStyleLending();

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Lending Dashboard</h2>
        <p className="text-muted-foreground">
          Manage your DeFi positions and monitor your financial health
        </p>
      </div>

      {/* Health Factor Display */}
      {userHealthFactor && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Wallet className="h-5 w-5" />
              Account Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HealthFactorIndicator current={userHealthFactor.health_factor} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Supplied</p>
                <p className="font-medium text-primary">${userHealthFactor.total_collateral_usd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Borrowed</p>
                <p className="font-medium text-destructive">${userHealthFactor.total_debt_usd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Available to Borrow</p>
                <p className="font-medium text-foreground">${userHealthFactor.available_borrow_usd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">LTV</p>
                <p className="font-medium text-foreground">{(userHealthFactor.ltv * 100).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="supplies" className="space-y-6">
        <TabsList className="bg-card border-0">
          <TabsTrigger value="supplies" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">
            <TrendingUp className="h-4 w-4 mr-1" />
            Supply Positions ({userSupplies.length})
          </TabsTrigger>
          <TabsTrigger value="borrows" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">
            <TrendingDown className="h-4 w-4 mr-1" />
            Borrow Positions ({userBorrows.length})
          </TabsTrigger>
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground">
            <PiggyBank className="h-4 w-4 mr-1" />
            Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supplies" className="space-y-4">
          {userSupplies.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2 text-foreground">No Supply Positions</h3>
                  <p className="text-muted-foreground">
                    Supply assets to start earning interest
                  </p>
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
          {userBorrows.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <TrendingDown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2 text-foreground">No Borrow Positions</h3>
                  <p className="text-muted-foreground">
                    Borrow against your collateral when needed
                  </p>
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

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Supply Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Supplied</span>
                    <span className="font-medium text-foreground">${totalSuppliedUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Positions</span>
                    <span className="font-medium text-foreground">{userSupplies.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Used as Collateral</span>
                    <span className="font-medium text-foreground">
                      {userSupplies.filter(s => s.used_as_collateral).length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  Borrow Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Borrowed</span>
                    <span className="font-medium text-foreground">${totalBorrowedUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Positions</span>
                    <span className="font-medium text-foreground">{userBorrows.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Variable Rate</span>
                    <span className="font-medium text-foreground">
                      {userBorrows.filter(b => b.rate_mode === 'variable').length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {userHealthFactor && userHealthFactor.health_factor < 1.5 && (
            <Card className="bg-destructive/10 border-destructive/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Health Factor Warning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Your health factor is low. Consider repaying debt or adding more collateral to avoid liquidation.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}