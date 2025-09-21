import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Activity, 
  BarChart3,
  Download,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
  Calendar,
  Zap
} from "lucide-react";
import { usePortfolioMonitoring } from "@/hooks/usePortfolioMonitoring";
import { useState, useEffect } from "react";
import { HistoricalAnalyticsService } from "@/services/historicalAnalyticsService";
import { useAuth } from "@/hooks/useAuth";

interface Timeframe {
  label: string;
  days: number;
  value: string;
}

const timeframes: Timeframe[] = [
  { label: "7D", days: 7, value: "7d" },
  { label: "30D", days: 30, value: "30d" },
  { label: "90D", days: 90, value: "90d" },
  { label: "1Y", days: 365, value: "1y" }
];

export function EnhancedPortfolioAnalytics() {
  const { user } = useAuth();
  const [selectedTimeframe, setSelectedTimeframe] = useState("30d");
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const {
    portfolioAssets,
    portfolioSummary,
    portfolioPerformance,
    portfolioHistory,
    assetsByType,
    loading: portfolioLoading
  } = usePortfolioMonitoring();

  const loadHistoricalData = async (timeframeDays: number) => {
    if (!user) return;
    
    setIsRefreshing(true);
    try {
      const data = await HistoricalAnalyticsService.getPositionHistory(user.id, timeframeDays);
      // Transform data for display
      const transformedData = {
        positions: data,
        totalGrowth: data.reduce((sum, pos) => sum + pos.pnl_usd, 0),
        totalGrowthPercent: data.length > 0 ? 
          (data[data.length - 1].pnl_usd / Math.max(data[0].supplied_amount, 1)) * 100 : 0,
        totalInterestEarned: data.reduce((sum, pos) => sum + Math.max(pos.pnl_usd, 0), 0),
        avgHealthFactor: data.length > 0 ? 
          data.reduce((sum, pos) => sum + pos.health_factor, 0) / data.length : 0,
        bestDay: data.reduce((best, pos) => pos.pnl_usd > best.pnl_usd ? pos : best, data[0] || { pnl_usd: 0 }),
        worstDay: data.reduce((worst, pos) => pos.pnl_usd < worst.pnl_usd ? pos : worst, data[0] || { pnl_usd: 0 })
      };
      setHistoricalData(transformedData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load historical data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const timeframe = timeframes.find(t => t.value === selectedTimeframe);
    if (timeframe) {
      loadHistoricalData(timeframe.days);
    }
  }, [selectedTimeframe, user]);

  const exportData = () => {
    if (!historicalData || !portfolioAssets) return;
    
    const dataToExport = {
      exported_at: new Date().toISOString(),
      timeframe: selectedTimeframe,
      portfolio_summary: portfolioSummary,
      portfolio_performance: portfolioPerformance,
      historical_data: historicalData,
      current_positions: portfolioAssets
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio-analytics-${selectedTimeframe}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (portfolioLoading) {
    return (
      <Card className="bg-surface-elevated border-border">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">Loading portfolio analytics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <Card className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                Advanced Portfolio Analytics
              </CardTitle>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex border border-border rounded-lg p-1 bg-surface-elevated">
                {timeframes.map((timeframe) => (
                  <Button
                    key={timeframe.value}
                    variant={selectedTimeframe === timeframe.value ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedTimeframe(timeframe.value)}
                    className="text-xs"
                  >
                    {timeframe.label}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const timeframe = timeframes.find(t => t.value === selectedTimeframe);
                  if (timeframe) loadHistoricalData(timeframe.days);
                }}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportData}
                disabled={!historicalData}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Performance Overview */}
      <Card className="bg-surface-elevated border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <p className="text-sm text-muted-foreground">Total Value</p>
              </div>
              <p className="text-2xl font-bold text-primary">${portfolioSummary.totalValueUSD.toFixed(2)}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-xs ${portfolioPerformance.change24hPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {portfolioPerformance.change24hPercent >= 0 ? '+' : ''}{portfolioPerformance.change24hPercent.toFixed(2)}%
                </span>
                <span className="text-xs text-muted-foreground">24h</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-green-600" />
                <p className="text-sm text-muted-foreground">Net APY</p>
              </div>
              <p className="text-2xl font-bold text-green-600">{portfolioSummary.netAPY.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground mt-1">Weighted average</p>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-muted-foreground">Net Interest</p>
              </div>
              <p className={`text-2xl font-bold ${portfolioPerformance.netInterest >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(portfolioPerformance.netInterest).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {portfolioPerformance.netInterest >= 0 ? 'Earned' : 'Paid'}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <p className="text-sm text-muted-foreground">Health Factor</p>
              </div>
              <p className={`text-2xl font-bold ${
                portfolioSummary.healthFactor > 2 ? 'text-green-600' :
                portfolioSummary.healthFactor > 1.5 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {portfolioSummary.healthFactor.toFixed(2)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {portfolioSummary.healthFactor > 2 ? 
                  <CheckCircle className="h-3 w-3 text-green-600" /> :
                  <AlertCircle className="h-3 w-3 text-orange-600" />
                }
                <span className="text-xs text-muted-foreground">
                  {portfolioSummary.healthFactor > 2 ? 'Safe' : 'Monitor'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historical Analysis */}
      {historicalData && (
        <Card className="bg-surface-elevated border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              Historical Analysis ({selectedTimeframe.toUpperCase()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground mb-2">Total Growth</p>
                <p className={`text-2xl font-bold ${historicalData.totalGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {historicalData.totalGrowth >= 0 ? '+' : ''}${Math.abs(historicalData.totalGrowth).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {historicalData.totalGrowthPercent >= 0 ? '+' : ''}{historicalData.totalGrowthPercent.toFixed(2)}%
                </p>
              </div>
              
              <div className="text-center p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground mb-2">Interest Earned</p>
                <p className="text-2xl font-bold text-green-600">
                  +${historicalData.totalInterestEarned.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  From lending positions
                </p>
              </div>
              
              <div className="text-center p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground mb-2">Avg Health Factor</p>
                <p className={`text-2xl font-bold ${
                  historicalData.avgHealthFactor > 2 ? 'text-green-600' :
                  historicalData.avgHealthFactor > 1.5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {historicalData.avgHealthFactor.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Period average
                </p>
              </div>
            </div>

            {historicalData.bestDay && historicalData.worstDay && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <p className="font-semibold text-green-600">Best Performance</p>
                  </div>
                  <p className="text-lg font-bold text-green-600">+${historicalData.bestDay.pnl_usd.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{historicalData.bestDay.date}</p>
                </div>
                
                <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <p className="font-semibold text-red-600">Worst Performance</p>
                  </div>
                  <p className="text-lg font-bold text-red-600">${historicalData.worstDay.pnl_usd.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{historicalData.worstDay.date}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Asset Allocation and Position Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-surface-elevated border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              Asset Allocation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {portfolioAssets.slice(0, 8).map((asset, index) => {
                const percentage = portfolioSummary.totalValueUSD > 0 
                  ? (Math.abs(asset.valueUSD) / portfolioSummary.totalValueUSD) * 100 
                  : 0;
                return (
                  <div key={`${asset.asset}-${asset.chain}-${index}`} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{asset.asset}</span>
                        <Badge variant="outline" className="text-xs">
                          {asset.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">${Math.abs(asset.valueUSD).toFixed(2)}</span>
                        <span className="font-medium">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              Position Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
                <p className="text-sm text-muted-foreground mb-1">Wallet Assets</p>
                <p className="text-lg font-bold text-primary">${portfolioSummary.walletValueUSD.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{assetsByType.wallet.length} assets</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-center">
                <p className="text-sm text-muted-foreground mb-1">Supplied</p>
                <p className="text-lg font-bold text-green-600">${portfolioSummary.suppliedValueUSD.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{assetsByType.supplied.length} positions</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                <p className="text-sm text-muted-foreground mb-1">Borrowed</p>
                <p className="text-lg font-bold text-red-600">${portfolioSummary.borrowedValueUSD.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{assetsByType.borrowed.length} positions</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
                <p className="text-sm text-muted-foreground mb-1">Available Borrow</p>
                <p className="text-lg font-bold text-blue-600">${portfolioSummary.availableBorrowUSD.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Capacity</p>
              </div>
            </div>

            <div className="space-y-3 mt-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Collateral Ratio</span>
                <span className="font-medium">
                  {((portfolioSummary.totalCollateralUSD / Math.max(portfolioSummary.totalValueUSD, 1)) * 100).toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={(portfolioSummary.totalCollateralUSD / Math.max(portfolioSummary.totalValueUSD, 1)) * 100} 
                className="h-2" 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Optimization Suggestions */}
      <Card className="bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 border-blue-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            Portfolio Optimization Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {portfolioSummary.healthFactor < 1.5 && (
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="font-semibold text-red-600">Critical: Low Health Factor</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Consider adding collateral or repaying debt to improve your health factor and reduce liquidation risk.
                </p>
              </div>
            )}
            
            {portfolioSummary.netAPY < 3 && (
              <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-yellow-600" />
                  <p className="font-semibold text-yellow-600">Yield Optimization</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your portfolio APY is below market average. Consider reallocating to higher-yield assets.
                </p>
              </div>
            )}
            
            {assetsByType.wallet.length > 0 && (
              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <p className="font-semibold text-blue-600">Idle Assets</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  You have ${portfolioSummary.walletValueUSD.toFixed(2)} in wallet assets. Consider supplying them to earn yield.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}