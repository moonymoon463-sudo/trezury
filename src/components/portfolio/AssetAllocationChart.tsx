import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
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
      TRZRY: 'hsl(280, 100%, 70%)', // Purple for Treasury
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
            ${(data.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
      <div className="flex items-center justify-center h-16 text-muted-foreground text-xs">
        No assets to display
      </div>
    );
  }

  return (
    <div className="flex flex-row items-center gap-3">
      {/* Compact Donut Chart */}
      <div className="h-16 w-16 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dataWithTotal}
              cx="50%"
              cy="50%"
              innerRadius={20}
              outerRadius={30}
              paddingAngle={1}
              dataKey="value"
              stroke="none"
            >
              {dataWithTotal.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Compact Legend */}
      <div className="flex-1 min-w-0 space-y-1">
        {data.slice(0, 4).map((item, index) => (
          <div key={index} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0" 
                style={{ backgroundColor: item.color }}
              />
              <span className="font-medium text-foreground truncate">{item.name}</span>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <span className="font-medium">
                ${(item.value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">
                {((item.value / totalValue) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}