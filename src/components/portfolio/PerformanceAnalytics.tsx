import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Percent,
  Calendar,
  Target
} from "lucide-react";
import { PortfolioSummary, PortfolioPerformance } from "@/hooks/usePortfolioMonitoring";
import { useMemo } from 'react';

interface PerformanceAnalyticsProps {
  summary: PortfolioSummary;
  performance: PortfolioPerformance;
  loading: boolean;
}

export function PerformanceAnalytics({ summary, performance, loading }: PerformanceAnalyticsProps) {
  // Generate mock historical performance data
  const performanceHistory = useMemo(() => {
    const days = 30;
    const baseValue = summary.totalValueUSD;
    return Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      
      // Simulate realistic portfolio performance with some volatility
      const volatility = 0.02; // 2% daily volatility
      const trend = 0.001; // Slight upward trend
      const randomChange = (Math.random() - 0.5) * volatility;
      const value = baseValue * (1 + trend * i + randomChange);
      
      return {
        date: date.toISOString().split('T')[0],
        value: Math.max(0, value),
        gains: value - baseValue,
        dayLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      };
    });
  }, [summary.totalValueUSD]);

  // Asset performance breakdown
  const assetPerformance = useMemo(() => [
    { asset: 'XAUT', returns: 5.2, allocation: 60, color: 'hsl(var(--warning))' },
    { asset: 'USDC', returns: 0.1, allocation: 35, color: 'hsl(var(--info))' },
    { asset: 'TRZRY', returns: 8.5, allocation: 5, color: 'hsl(var(--primary))' }
  ], []);

  // Monthly performance data
  const monthlyData = useMemo(() => [
    { month: 'Jan', value: summary.totalValueUSD * 0.92, gains: summary.totalValueUSD * 0.02 },
    { month: 'Feb', value: summary.totalValueUSD * 0.95, gains: summary.totalValueUSD * 0.03 },
    { month: 'Mar', value: summary.totalValueUSD * 0.98, gains: summary.totalValueUSD * 0.05 },
    { month: 'Apr', value: summary.totalValueUSD, gains: summary.totalValueUSD * 0.08 }
  ], [summary.totalValueUSD]);

  const formatCurrency = (value: number) => 
    `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const formatPercent = (value: number) => 
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Performance Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-40 bg-surface-elevated rounded" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-surface-elevated rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Performance Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Performance Chart */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceHistory}>
                  <defs>
                    <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="dayLabel" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis hide />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload[0]) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border rounded-lg p-3 shadow-md">
                            <p className="text-sm font-medium">{label}</p>
                            <p className="text-sm text-primary">
                              Value: {formatCurrency(data.value)}
                            </p>
                            <p className={`text-sm ${data.gains >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                              P&L: {data.gains >= 0 ? '+' : ''}{formatCurrency(data.gains)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#valueGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-surface-elevated rounded-lg">
                <DollarSign className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Total Return</p>
                <p className="text-sm font-bold text-status-success">
                  {formatCurrency(summary.totalGains)}
                </p>
              </div>
              <div className="text-center p-3 bg-surface-elevated rounded-lg">
                <Percent className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Return %</p>
                <p className="text-sm font-bold text-status-success">
                  {formatPercent(summary.totalGainsPercent)}
                </p>
              </div>
              <div className="text-center p-3 bg-surface-elevated rounded-lg">
                <Target className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Net APY</p>
                <p className="text-sm font-bold text-primary">
                  {formatPercent(summary.netAPY * 100)}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assets" className="space-y-4">
            {/* Asset Performance Chart */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetPerformance}>
                  <XAxis dataKey="asset" axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload[0]) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border rounded-lg p-3 shadow-md">
                            <p className="text-sm font-medium">{data.asset}</p>
                            <p className="text-sm">Returns: {formatPercent(data.returns)}</p>
                            <p className="text-sm">Allocation: {data.allocation}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="returns" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Asset Breakdown */}
            <div className="space-y-2">
              {assetPerformance.map((asset) => (
                <div key={asset.asset} className="flex items-center justify-between p-2 bg-surface-elevated rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: asset.color }}
                    />
                    <span className="font-medium text-sm">{asset.asset}</span>
                  </div>
                  <div className="text-right">
                    <Badge variant={asset.returns >= 0 ? "default" : "destructive"}>
                      {formatPercent(asset.returns)}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {asset.allocation}% allocation
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {/* Monthly Performance */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload[0]) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border rounded-lg p-3 shadow-md">
                            <p className="text-sm font-medium">{data.month}</p>
                            <p className="text-sm">Value: {formatCurrency(data.value)}</p>
                            <p className="text-sm">Gains: {formatCurrency(data.gains)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="gains" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Historical Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-surface-elevated rounded-lg">
                <Calendar className="h-4 w-4 mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Best Month</p>
                <p className="text-sm font-bold text-status-success">+8.5%</p>
              </div>
              <div className="p-3 bg-surface-elevated rounded-lg">
                <TrendingUp className="h-4 w-4 mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Avg Monthly</p>
                <p className="text-sm font-bold text-primary">+4.2%</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}