import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Download, Eye, Target } from 'lucide-react';

interface AdvancedAnalyticsProps {
  portfolioData?: any;
  timeframe?: '24h' | '7d' | '30d' | '90d' | '1y';
  onTimeframeChange?: (timeframe: string) => void;
}

// Mock data for demo - in production this would come from the analytics hook
const mockPerformanceData = [
  { date: '2024-01-01', portfolioValue: 10000, goldPrice: 2000, profit: 0 },
  { date: '2024-01-15', portfolioValue: 10200, goldPrice: 2040, profit: 200 },
  { date: '2024-02-01', portfolioValue: 9800, goldPrice: 1960, profit: -200 },
  { date: '2024-02-15', portfolioValue: 10500, goldPrice: 2100, profit: 500 },
  { date: '2024-03-01', portfolioValue: 10800, goldPrice: 2160, profit: 800 },
  { date: '2024-03-15', portfolioValue: 11200, goldPrice: 2240, profit: 1200 },
];

const mockAllocationHistory = [
  { month: 'Jan', gold: 65, usdc: 35 },
  { month: 'Feb', gold: 70, usdc: 30 },
  { month: 'Mar', gold: 68, usdc: 32 },
  { month: 'Apr', gold: 72, usdc: 28 },
  { month: 'May', gold: 69, usdc: 31 },
  { month: 'Jun', gold: 74, usdc: 26 },
];

const mockRiskMetrics = [
  { metric: 'Volatility', value: 15.2, status: 'medium' },
  { metric: 'Sharpe Ratio', value: 1.34, status: 'good' },
  { metric: 'Max Drawdown', value: -8.5, status: 'low' },
  { metric: 'Beta', value: 0.87, status: 'good' },
];

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export function AdvancedAnalytics({ portfolioData, timeframe = '30d', onTimeframeChange }: AdvancedAnalyticsProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-success';
      case 'medium': return 'text-warning';
      case 'low': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'good': return 'bg-success text-success-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Advanced Analytics
            </CardTitle>
            <CardDescription>
              Comprehensive portfolio performance analysis and insights
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              View Report
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="allocation">Allocation</TabsTrigger>
            <TabsTrigger value="risk">Risk Metrics</TabsTrigger>
            <TabsTrigger value="correlation">Correlation</TabsTrigger>
          </TabsList>

          {/* Performance Analysis */}
          <TabsContent value="performance" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">Timeframe:</span>
              <div className="flex gap-1">
                {['24h', '7d', '30d', '90d', '1y'].map((period) => (
                  <Button
                    key={period}
                    variant={timeframe === period ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => onTimeframeChange?.(period)}
                  >
                    {period}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Return</p>
                      <p className="text-2xl font-bold text-success">+12.5%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-success" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Annualized Return</p>
                      <p className="text-2xl font-bold">+18.7%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Best Month</p>
                      <p className="text-2xl font-bold text-success">+8.9%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-success" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'portfolioValue' ? `$${value?.toLocaleString()}` : `$${value}`,
                      name === 'portfolioValue' ? 'Portfolio Value' : name === 'profit' ? 'Profit/Loss' : 'Gold Price'
                    ]}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="portfolioValue"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Allocation Analysis */}
          <TabsContent value="allocation" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-4">Allocation Trend</h4>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mockAllocationHistory}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip formatter={(value) => [`${value}%`, '']} />
                      <Bar dataKey="gold" stackId="a" fill="hsl(var(--primary))" />
                      <Bar dataKey="usdc" stackId="a" fill="hsl(var(--secondary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-4">Current Allocation</h4>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Gold (XAUT)', value: 70, color: COLORS[0] },
                          { name: 'USDC', value: 30, color: COLORS[1] }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {[
                          { name: 'Gold (XAUT)', value: 70 },
                          { name: 'USDC', value: 30 }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Risk Metrics */}
          <TabsContent value="risk" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockRiskMetrics.map((metric, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{metric.metric}</p>
                        <p className={`text-xl font-bold ${getStatusColor(metric.status)}`}>
                          {metric.value > 0 && metric.metric !== 'Max Drawdown' ? '+' : ''}{metric.value}
                          {metric.metric === 'Volatility' || metric.metric === 'Max Drawdown' ? '%' : ''}
                        </p>
                      </div>
                      <Badge className={getStatusBadge(metric.status)}>
                        {metric.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-4">Risk Assessment Summary</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-success mt-2" />
                    <div>
                      <strong>Low to Medium Risk Profile:</strong> Your portfolio shows balanced risk characteristics with moderate volatility.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-warning mt-2" />
                    <div>
                      <strong>Concentration Risk:</strong> 70% allocation to gold may increase volatility during market stress.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div>
                      <strong>Performance Consistency:</strong> Strong Sharpe ratio indicates good risk-adjusted returns.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Correlation Analysis */}
          <TabsContent value="correlation" className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Correlation Analysis</h3>
              <p className="text-sm max-w-md mx-auto">
                Advanced correlation analysis with market indices, commodities, and economic indicators coming soon.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}