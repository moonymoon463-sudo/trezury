import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { PortfolioAsset } from "@/hooks/usePortfolioMonitoring";
import { PieChart as PieChartIcon } from "lucide-react";

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-primary" />
          Asset Allocation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dataWithTotal}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {dataWithTotal.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="mt-4 space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm font-medium">{item.name}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  ${item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {((item.value / totalValue) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}