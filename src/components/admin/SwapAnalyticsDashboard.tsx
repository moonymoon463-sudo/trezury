import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowUpDown,
  DollarSign,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SwapAnalyticsService } from '@/services/SwapAnalyticsService';
import AurumLogo from '@/components/AurumLogo';

interface SwapMetrics {
  total_swaps: number;
  total_volume_usd: number;
  success_rate: number;
  average_slippage: number;
  average_execution_time: number;
  failed_swaps: number;
  most_traded_pair: string;
  daily_volume: number;
}

interface DEXPerformance {
  dex_name: string;
  volume_24h: number;
  trades_count: number;
  success_rate: number;
  average_slippage: number;
  liquidity_score: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface LiquidityData {
  pair: string;
  liquidity_usd: number;
  volume_24h: number;
  price_impact: number;
  spread: number;
}

const SwapAnalyticsDashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<SwapMetrics | null>(null);
  const [dexPerformance, setDexPerformance] = useState<DEXPerformance[]>([]);
  const [liquidityData, setLiquidityData] = useState<LiquidityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadSwapMetrics = async () => {
    try {
      const data = await SwapAnalyticsService.getSwapMetrics();
      setMetrics(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load swap metrics:', error);
    }
  };

  const loadDEXPerformance = async () => {
    try {
      const data = await SwapAnalyticsService.getDEXPerformance();
      setDexPerformance(data);
    } catch (error) {
      console.error('Failed to load DEX performance:', error);
    }
  };

  const loadLiquidityData = async () => {
    try {
      const data = await SwapAnalyticsService.getLiquidityAnalysis();
      setLiquidityData(data);
    } catch (error) {
      console.error('Failed to load liquidity data:', error);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([
        loadSwapMetrics(),
        loadDEXPerformance(),
        loadLiquidityData()
      ]);
      setLoading(false);
    };

    initializeData();

    // Set up periodic updates
    const interval = setInterval(() => {
      loadSwapMetrics();
      loadDEXPerformance();
      loadLiquidityData();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPerformanceIcon = (rate: number) => {
    if (rate >= 95) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (rate >= 85) return <Activity className="h-4 w-4 text-yellow-500" />;
    return <AlertTriangle className="h-4 w-4 text-red-500" />;
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading swap analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin')}
              className="text-foreground hover:bg-accent"
            >
              <ArrowLeft size={24} />
            </Button>
            <AurumLogo className="w-8 h-8" />
            <h1 className="text-xl font-bold text-foreground">Swap Analytics</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowUpDown className="w-4 h-4" />
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                loadSwapMetrics();
                loadDEXPerformance();
                loadLiquidityData();
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Swaps</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.total_swaps || 0}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics?.total_volume_usd || 0)}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(metrics?.daily_volume || 0)} today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.success_rate?.toFixed(1) || 0}%</div>
              <p className="text-xs text-muted-foreground">
                {metrics?.failed_swaps || 0} failed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Slippage</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.average_slippage?.toFixed(2) || 0}%</div>
              <p className="text-xs text-muted-foreground">
                {metrics?.average_execution_time || 0}ms avg time
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="dex-performance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dex-performance">DEX Performance</TabsTrigger>
            <TabsTrigger value="liquidity">Liquidity Analysis</TabsTrigger>
            <TabsTrigger value="trends">Historical Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="dex-performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>DEX Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dexPerformance.map((dex) => (
                    <div key={dex.dex_name} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {getPerformanceIcon(dex.success_rate)}
                          <span className="font-medium">{dex.dex_name}</span>
                        </div>
                        <Badge variant="default" className={getStatusColor(dex.status)}>
                          {dex.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{formatCurrency(dex.volume_24h)}</div>
                          <div className="text-muted-foreground">24h Volume</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{dex.trades_count}</div>
                          <div className="text-muted-foreground">Trades</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{dex.success_rate.toFixed(1)}%</div>
                          <div className="text-muted-foreground">Success</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{dex.average_slippage.toFixed(2)}%</div>
                          <div className="text-muted-foreground">Slippage</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="liquidity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Liquidity Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {liquidityData.map((pair) => (
                    <div key={pair.pair} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="font-medium">{pair.pair}</div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{formatCurrency(pair.liquidity_usd)}</div>
                          <div className="text-muted-foreground">Liquidity</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{formatCurrency(pair.volume_24h)}</div>
                          <div className="text-muted-foreground">24h Volume</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{pair.price_impact.toFixed(2)}%</div>
                          <div className="text-muted-foreground">Price Impact</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{pair.spread.toFixed(3)}%</div>
                          <div className="text-muted-foreground">Spread</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Historical Performance Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Best Performing Pair</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold">{metrics?.most_traded_pair || 'USDC/XAUT'}</div>
                        <p className="text-sm text-muted-foreground">Highest success rate</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Average Daily Volume</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold">{formatCurrency(metrics?.daily_volume || 0)}</div>
                        <p className="text-sm text-muted-foreground">Last 30 days</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Peak Performance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold">98.5%</div>
                        <p className="text-sm text-muted-foreground">Best success rate</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SwapAnalyticsDashboard;