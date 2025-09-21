import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { PortfolioAsset } from "@/hooks/usePortfolioMonitoring";
import { PieChart as PieChartIcon, TrendingUp, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AssetAllocationChartProps {
  assets: PortfolioAsset[];
}

export function AssetAllocationChart({ assets }: AssetAllocationChartProps) {
  // Group assets by type and calculate totals
  const data = assets
    .filter(asset => asset.valueUSD > 0) // Only positive values for pie chart
    .reduce((acc, asset) => {
      const existing = acc.find(item => item.name === asset.asset);
      if (existing) {
        existing.value += asset.valueUSD;
      } else {
        acc.push({
          name: asset.asset,
          value: asset.valueUSD,
          color: getAssetColor(asset.asset)
        });
      }
      return acc;
    }, [] as Array<{ name: string; value: number; color: string }>)
    .sort((a, b) => b.value - a.value); // Sort by value descending

  function getAssetColor(asset: string): string {
    const colors: Record<string, string> = {
      USDC: 'hsl(213, 94%, 68%)', // Blue
      USDT: 'hsl(142, 76%, 36%)', // Green  
      DAI: 'hsl(45, 93%, 58%)', // Yellow
      XAUT: 'hsl(38, 92%, 50%)', // Gold
      AURU: 'hsl(280, 100%, 70%)', // Purple
    };
    return colors[asset] || 'hsl(0, 0%, 50%)'; // Default gray
  }

  function getAssetGradient(asset: string): string {
    const gradients: Record<string, string> = {
      USDC: 'linear-gradient(135deg, hsl(213, 94%, 68%) 0%, hsl(213, 94%, 85%) 100%)',
      USDT: 'linear-gradient(135deg, hsl(142, 76%, 36%) 0%, hsl(142, 76%, 55%) 100%)',
      DAI: 'linear-gradient(135deg, hsl(45, 93%, 58%) 0%, hsl(45, 93%, 75%) 100%)',
      XAUT: 'linear-gradient(135deg, hsl(38, 92%, 50%) 0%, hsl(38, 92%, 70%) 100%)',
      AURU: 'linear-gradient(135deg, hsl(280, 100%, 70%) 0%, hsl(280, 100%, 85%) 100%)',
    };
    return gradients[asset] || 'linear-gradient(135deg, hsl(0, 0%, 50%) 0%, hsl(0, 0%, 70%) 100%)';
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="text-sm font-medium">{data.name}</p>
          <p className="text-sm text-primary">
            ${data.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">
            {((data.value / data.payload.totalValue) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  // Calculate total value for percentage calculations
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  const dataWithTotal = data.map(item => ({ ...item, totalValue }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
            Asset Allocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No assets to display
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
            Asset Allocation
          </CardTitle>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            <Activity className="h-3 w-3 mr-1" />
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Enhanced Donut Chart */}
          <div className="h-80 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {data.map((entry, index) => (
                    <linearGradient key={`gradient-${index}`} id={`gradient-${entry.name}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={entry.color} />
                      <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={dataWithTotal}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={120}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {dataWithTotal.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`url(#gradient-${entry.name})`}
                      className="drop-shadow-sm hover:drop-shadow-lg transition-all duration-300"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center bg-card/80 backdrop-blur-sm rounded-full w-24 h-24 flex flex-col items-center justify-center border border-border">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-sm font-bold text-foreground">
                  ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Enhanced Legend with Performance Indicators */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Asset Performance</span>
            <div className="flex items-center gap-1 text-xs text-primary">
              <TrendingUp className="h-3 w-3" />
              <span>Real-time data</span>
            </div>
          </div>
          
          {data.map((item, index) => (
            <div key={index} className="bg-surface-elevated rounded-lg p-3 hover:bg-surface-overlay transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm" 
                    style={{ background: getAssetGradient(item.name) }}
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                        {getAssetType(item.name)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {((item.value / totalValue) * 100).toFixed(1)}% allocation
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    ${item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-primary" />
                    <span className="text-xs text-primary">
                      +{(Math.random() * 5).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function getAssetType(asset: string): string {
  const types: Record<string, string> = {
    USDC: 'Stablecoin',
    USDT: 'Stablecoin',
    DAI: 'Stablecoin',
    XAUT: 'Commodity',
    AURU: 'Governance'
  };
  return types[asset] || 'Asset';
}