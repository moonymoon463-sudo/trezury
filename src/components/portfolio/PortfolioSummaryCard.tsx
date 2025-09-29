import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Activity, Shield, BarChart3, Zap, AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight, Eye, ExternalLink } from "lucide-react";
import { PortfolioSummary, PortfolioPerformance, PortfolioAsset } from "@/hooks/usePortfolioMonitoring";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, AreaChart, Area } from 'recharts';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PortfolioSummaryCardProps {
  summary: PortfolioSummary;
  performance: PortfolioPerformance;
  assets: PortfolioAsset[];
  compact?: boolean;
  interactive?: boolean;
}

export function PortfolioSummaryCard({ summary, performance, assets, compact = false, interactive = true }: PortfolioSummaryCardProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [chartExpanded, setChartExpanded] = useState(false);
  const isPositiveChange = performance.change24hPercent >= 0;

  // Process assets for charts
  const chartData = useMemo(() => {
    if (!assets || assets.length === 0) return [];
    
    const assetGroups = assets.reduce((acc, asset) => {
      if (asset.valueUSD <= 0) return acc;
      
      const key = asset.asset;
      if (!acc[key]) {
        acc[key] = { name: key, value: 0 };
      }
      acc[key].value += asset.valueUSD;
      return acc;
    }, {} as Record<string, { name: string; value: number }>);

    return Object.values(assetGroups).sort((a, b) => b.value - a.value);
  }, [assets]);

  // Mock performance data for sparklines
  const performanceData = useMemo(() => {
    const baseValue = summary.totalValueUSD;
    return Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      value: baseValue + (Math.random() - 0.5) * baseValue * 0.05,
    }));
  }, [summary.totalValueUSD]);

  const getAssetColor = (asset: string) => {
    const colors = {
      'GOLD': 'hsl(var(--warning))',
      'USDC': 'hsl(var(--info))',
      'ETH': 'hsl(var(--accent))',
      'BTC': 'hsl(var(--primary))',
      'XAUT': 'hsl(var(--warning))',
      'AURU': 'hsl(var(--primary))',
    };
    return colors[asset as keyof typeof colors] || 'hsl(var(--primary))';
  };

  // Health factor visual indicator
  const getHealthFactorStatus = (healthFactor: number) => {
    if (healthFactor >= 2.0) return { color: 'text-status-success', icon: CheckCircle, label: 'Healthy' };
    if (healthFactor >= 1.2) return { color: 'text-warning', icon: AlertTriangle, label: 'Moderate' };
    return { color: 'text-status-error', icon: AlertTriangle, label: 'Risk' };
  };

  const healthStatus = getHealthFactorStatus(summary.healthFactor);

  // Risk metrics
  const riskMetrics = useMemo(() => {
    const totalValue = summary.totalValueUSD;
    const concentrationRisk = chartData.length > 0 
      ? Math.max(...chartData.map(asset => (asset.value / totalValue) * 100))
      : 0;
    
    return {
      liquidationRisk: summary.healthFactor < 1.5 ? 'high' : summary.healthFactor < 2.0 ? 'medium' : 'low',
      concentrationRisk: concentrationRisk > 70 ? 'high' : concentrationRisk > 50 ? 'medium' : 'low',
      apyRisk: summary.netAPY > 15 ? 'high' : summary.netAPY > 8 ? 'medium' : 'low'
    };
  }, [summary, chartData]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-status-error';
      case 'medium': return 'text-warning';
      case 'low': return 'text-status-success';
      default: return 'text-muted-foreground';
    }
  };

  // Interactive metric cards
  const InteractiveMetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    trend, 
    onClick, 
    action 
  }: {
    title: string;
    value: string;
    icon: any;
    trend?: { value: number; isPositive: boolean };
    onClick?: () => void;
    action?: string;
  }) => (
    <div 
      className={`p-2 bg-surface-elevated rounded-lg hover:bg-surface-elevated/80 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <Icon className="h-3 w-3 text-primary" />
          <span className="text-xs text-muted-foreground">{title}</span>
        </div>
        {onClick && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{value}</span>
        {trend && (
          <div className="flex items-center gap-0.5">
            {trend.isPositive ? (
              <ArrowUpRight className="h-3 w-3 text-status-success" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-status-error" />
            )}
            <span className={`text-xs ${trend.isPositive ? 'text-status-success' : 'text-status-error'}`}>
              {Math.abs(trend.value).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      {action && (
        <Button size="sm" variant="outline" className="w-full mt-1 h-6 text-xs">
          {action}
        </Button>
      )}
    </div>
  );

  if (!interactive) {
    // Fallback to original compact layout for non-interactive mode
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-4 w-4 text-primary" />
            Portfolio Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-xl font-bold">
                ${(summary.totalValueUSD || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <Badge variant={isPositiveChange ? "default" : "destructive"}>
              {isPositiveChange ? '+' : ''}{performance.change24hPercent.toFixed(2)}%
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-4 w-4 text-primary" />
          Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-8">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
            <TabsTrigger value="health" className="text-xs">Health</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3 mt-3">
            {/* Total Value with Clickable Chart */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Total Portfolio Value</p>
                <p className="text-2xl font-bold text-foreground">
                  ${(summary.totalValueUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {isPositiveChange ? (
                    <TrendingUp className="h-4 w-4 text-status-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-status-error" />
                  )}
                  <span className={`text-xs font-medium ${
                    isPositiveChange ? 'text-status-success' : 'text-status-error'
                  }`}>
                    {isPositiveChange ? '+' : ''}{performance.change24hPercent.toFixed(2)}% (24h)
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-4 w-4 p-0 ml-1" 
                    onClick={() => setChartExpanded(!chartExpanded)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              {/* Interactive Asset Mix Chart */}
              {chartData.length > 0 && (
                <div 
                  className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setChartExpanded(!chartExpanded)}
                >
                  <p className="text-xs text-muted-foreground mb-2">Asset Mix</p>
                  <div className="w-16 h-16 relative bg-surface-elevated rounded-full p-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={16}
                          outerRadius={28}
                          strokeWidth={0}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={getAssetColor(entry.name)}
                              className="hover:opacity-80 transition-opacity"
                            />
                          ))}
                        </Pie>
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload[0]) {
                            const data = payload[0].payload;
                            const total = chartData.reduce((sum, item) => sum + item.value, 0);
                            const percentage = total > 0 ? (data.value / total) * 100 : 0;
                            return (
                              <div className="bg-popover border border-border rounded-lg p-2 shadow-md">
                                <p className="text-sm font-medium">{data.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  ${data.value.toLocaleString('en-US', { maximumFractionDigits: 0 })} ({percentage.toFixed(1)}%)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <InteractiveMetricCard
                title="Wallet"
                value={`$${(summary.walletValueUSD || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                icon={Wallet}
                onClick={() => navigate('/wallet')}
                action="Manage"
              />
              <InteractiveMetricCard
                title="Lending"
                value={`$${(summary.suppliedValueUSD || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                icon={PiggyBank}
                trend={{ value: 2.3, isPositive: true }}
                onClick={() => navigate('/lending?tab=supply')}
                action="Supply More"
              />
              <InteractiveMetricCard
                title="Borrowed"
                value={`$${(summary.borrowedValueUSD || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                icon={TrendingDown}
                onClick={() => navigate('/lending?tab=borrow')}
                action="Repay"
              />
              <InteractiveMetricCard
                title="Net Worth"
                value={`$${(summary.netValueUSD || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                icon={BarChart3}
                trend={{ value: 1.8, isPositive: true }}
              />
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 h-8 text-xs"
                onClick={() => navigate('/lending?tab=supply')}
              >
                <Zap className="h-3 w-3 mr-1" />
                Optimize Yield
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 h-8 text-xs"
                onClick={() => navigate('/lending')}
              >
                <Eye className="h-3 w-3 mr-1" />
                View Lending
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-3 mt-3">
            {/* Performance Chart */}
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Net APY</p>
                <p className={`text-sm font-bold ${
                  summary.netAPY >= 0 ? 'text-status-success' : 'text-status-error'
                }`}>
                  {summary.netAPY >= 0 ? '+' : ''}{(summary.netAPY * 100).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Interest Earned</p>
                <p className="text-sm font-bold text-status-success">
                  +${performance.totalEarnedInterest.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Interest Paid</p>
                <p className="text-sm font-bold text-status-error">
                  -${performance.totalPaidInterest.toFixed(2)}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="health" className="space-y-3 mt-3">
            {/* Health Factor Gauge */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <healthStatus.icon className={`h-4 w-4 ${healthStatus.color}`} />
                <span className="text-sm font-medium">Health Factor: {summary.healthFactor.toFixed(2)}</span>
              </div>
              <div className="w-full bg-surface-elevated rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    summary.healthFactor >= 2.0 ? 'bg-status-success' :
                    summary.healthFactor >= 1.2 ? 'bg-warning' : 'bg-status-error'
                  }`}
                  style={{ 
                    width: `${Math.min(100, (summary.healthFactor / 3) * 100)}%` 
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {healthStatus.label} • Liquidation at 1.0
              </p>
            </div>

            {/* Available Borrowing */}
            {summary.availableBorrowUSD > 0 && (
              <div className="p-2 bg-surface-elevated rounded-lg">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">Available to Borrow</span>
                  <Button size="sm" variant="outline" className="h-6 text-xs">
                    Borrow
                  </Button>
                </div>
                <span className="text-sm font-semibold text-primary">
                  ${summary.availableBorrowUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-3 mt-3">
            {/* Risk Assessment */}
            <div className="space-y-2">
              <p className="text-xs font-medium">Risk Assessment</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${
                    getRiskColor(riskMetrics.liquidationRisk).replace('text-', 'bg-')
                  }`} />
                  <p className="text-xs text-muted-foreground">Liquidation</p>
                  <p className={`text-xs font-medium capitalize ${getRiskColor(riskMetrics.liquidationRisk)}`}>
                    {riskMetrics.liquidationRisk}
                  </p>
                </div>
                <div className="text-center">
                  <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${
                    getRiskColor(riskMetrics.concentrationRisk).replace('text-', 'bg-')
                  }`} />
                  <p className="text-xs text-muted-foreground">Concentration</p>
                  <p className={`text-xs font-medium capitalize ${getRiskColor(riskMetrics.concentrationRisk)}`}>
                    {riskMetrics.concentrationRisk}
                  </p>
                </div>
                <div className="text-center">
                  <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${
                    getRiskColor(riskMetrics.apyRisk).replace('text-', 'bg-')
                  }`} />
                  <p className="text-xs text-muted-foreground">APY</p>
                  <p className={`text-xs font-medium capitalize ${getRiskColor(riskMetrics.apyRisk)}`}>
                    {riskMetrics.apyRisk}
                  </p>
                </div>
              </div>
            </div>

            {/* Asset Allocation Breakdown */}
            {chartData.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Asset Allocation</p>
                {chartData.slice(0, 3).map((asset, index) => {
                  const total = chartData.reduce((sum, item) => sum + item.value, 0);
                  const percentage = total > 0 ? (asset.value / total) * 100 : 0;
                  return (
                    <div key={asset.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: getAssetColor(asset.name) }}
                        />
                        <span>{asset.name}</span>
                      </div>
                      <span className="font-medium">{percentage.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Analytics Action Button */}
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full h-8 text-xs mt-2"
              onClick={() => navigate('/lending?tab=analytics')}
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              View Full Analytics
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}