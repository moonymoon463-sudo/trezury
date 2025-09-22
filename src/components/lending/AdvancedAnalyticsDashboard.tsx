import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  AlertTriangle, 
  DollarSign,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { useAdvancedFeatures } from '@/hooks/useAdvancedFeatures';

export const AdvancedAnalyticsDashboard: React.FC = () => {
  const { 
    portfolioRisk, 
    stressTestResults, 
    treasuryMetrics, 
    revenueShare,
    runStressTest,
    loading 
  } = useAdvancedFeatures();

  const handleStressTest = () => {
    runStressTest(['market_crash', 'gold_volatility', 'liquidity_crisis']);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Advanced Analytics</h2>
        <Button 
          onClick={handleStressTest}
          disabled={loading}
          variant="outline"
          className="gap-2"
        >
          <Activity className="h-4 w-4" />
          Run Stress Test
        </Button>
      </div>

      <Tabs defaultValue="portfolio" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-card">
          <TabsTrigger value="portfolio">Portfolio Risk</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="treasury">Treasury</TabsTrigger>
          <TabsTrigger value="stress">Stress Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="space-y-4">
          {portfolioRisk && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Collateral
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">
                      ${portfolioRisk.totalCollateralUsd.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Debt
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">
                      ${portfolioRisk.totalDebtUsd.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Diversification Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-foreground">
                        {portfolioRisk.diversificationScore.toFixed(0)}
                      </div>
                      <PieChart className="h-5 w-5 text-primary" />
                    </div>
                    <Progress 
                      value={portfolioRisk.diversificationScore} 
                      className="mt-2"
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Risk Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Overall Risk</span>
                      <Badge 
                        variant={portfolioRisk.overallRiskLevel === 'low' ? 'default' : 'destructive'}
                        className="capitalize"
                      >
                        {portfolioRisk.overallRiskLevel}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Concentration Risks</span>
                      {portfolioRisk.concentrationRisks.map((risk, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{risk.asset}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">{risk.percentage.toFixed(1)}%</span>
                            <Badge 
                              variant={risk.riskLevel === 'low' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {risk.riskLevel}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {portfolioRisk.recommendations.map((rec, index) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          • {rec}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Yield Earned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">$12,456</div>
                <div className="flex items-center gap-1 text-sm text-success">
                  <TrendingUp className="h-3 w-3" />
                  +8.5% this month
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Average APY
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">4.8%</div>
                <div className="flex items-center gap-1 text-sm text-success">
                  <TrendingUp className="h-3 w-3" />
                  +0.3% vs last month
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Fees Paid
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">$234</div>
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <TrendingDown className="h-3 w-3" />
                  -12% vs last month
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">$12,222</div>
                <div className="flex items-center gap-1 text-sm text-success">
                  <TrendingUp className="h-3 w-3" />
                  +9.2% this month
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="treasury" className="space-y-4">
          {treasuryMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Protocol Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    ${treasuryMetrics.totalRevenue.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Monthly Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    ${treasuryMetrics.monthlyRevenue.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Reserve Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    ${treasuryMetrics.reserveBalance.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {revenueShare && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Your Revenue Share
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">AURU Balance</div>
                    <div className="text-lg font-semibold text-foreground">
                      {revenueShare.auruBalance.toLocaleString()} AURU
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Share Percentage</div>
                    <div className="text-lg font-semibold text-foreground">
                      {revenueShare.sharePercentage.toFixed(4)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Monthly Revenue</div>
                    <div className="text-lg font-semibold text-foreground">
                      ${revenueShare.monthlyRevenue.toFixed(2)}
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Next distribution: {revenueShare.nextDistribution}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="stress" className="space-y-4">
          {stressTestResults.length > 0 ? (
            <div className="space-y-4">
              {stressTestResults.map((result, index) => (
                <Card key={index} className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="capitalize">{result.scenario.replace('_', ' ')}</span>
                      <Badge 
                        variant={result.liquidationRisk ? 'destructive' : 'default'}
                      >
                        {result.liquidationRisk ? 'High Risk' : 'Safe'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Resulting Health Factor</div>
                        <div className="text-lg font-semibold text-foreground">
                          {result.resultingHealthFactor.toFixed(3)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Action Required</div>
                        <div className="text-lg font-semibold text-foreground">
                          {result.actionRequired ? 'Yes' : 'No'}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Price Changes</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(result.priceChanges).map(([asset, change]) => (
                          <div key={asset} className="text-sm">
                            <span className="text-muted-foreground">{asset}: </span>
                            <span className={change < 0 ? 'text-destructive' : 'text-success'}>
                              {change > 0 ? '+' : ''}{(change * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <div className="text-lg font-medium text-foreground mb-2">
                  No Stress Tests Run
                </div>
                <div className="text-muted-foreground mb-4">
                  Run stress tests to analyze portfolio resilience under different market conditions
                </div>
                <Button onClick={handleStressTest} disabled={loading}>
                  Run Stress Test
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};