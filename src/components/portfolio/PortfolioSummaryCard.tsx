import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { PortfolioSummary, PortfolioPerformance, PortfolioAsset } from "@/hooks/usePortfolioMonitoring";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useMemo } from 'react';

interface PortfolioSummaryCardProps {
  summary: PortfolioSummary;
  performance: PortfolioPerformance;
  assets: PortfolioAsset[];
}

export function PortfolioSummaryCard({ summary, performance, assets }: PortfolioSummaryCardProps) {
  const isPositiveChange = performance.change24hPercent >= 0;

  // Process assets for mini donut chart
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

  const getAssetColor = (asset: string) => {
    const colors = {
      'GOLD': 'hsl(var(--warning))',
      'USDC': 'hsl(var(--info))',
      'ETH': 'hsl(var(--accent))',
      'BTC': 'hsl(var(--primary))',
    };
    return colors[asset as keyof typeof colors] || 'hsl(var(--primary))';
  };

  // Calculate percentages for legend
  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);
  const topAssets = chartData.slice(0, 3).map(asset => ({
    ...asset,
    percentage: totalValue > 0 ? (asset.value / totalValue) * 100 : 0
  }));

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      const percentage = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
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
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Portfolio Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Portfolio Value with Asset Mix */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
            <p className="text-3xl font-bold text-foreground">
              ${summary.totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {isPositiveChange ? (
                <TrendingUp className="h-4 w-4 text-status-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-status-error" />
              )}
              <span className={`text-sm font-medium ${
                isPositiveChange ? 'text-status-success' : 'text-status-error'
              }`}>
                {isPositiveChange ? '+' : ''}{performance.change24hPercent.toFixed(2)}% (24h)
              </span>
            </div>
          </div>
          
          {/* Asset Mix Chart */}
          {chartData.length > 0 && (
            <div className="flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-2">Asset Mix</p>
              <div className="w-20 h-20 relative bg-surface-elevated rounded-full p-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={35}
                      strokeWidth={0}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getAssetColor(entry.name)}
                          className="hover:opacity-80 cursor-pointer transition-opacity"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Asset Mix Legend */}
        {topAssets.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center text-xs">
            {topAssets.map((asset, index) => (
              <div key={asset.name} className="flex items-center gap-1">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: getAssetColor(asset.name) }}
                />
                <span className="text-muted-foreground">
                  {asset.name} {asset.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Portfolio Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Wallet Balance</p>
            <p className="text-lg font-semibold text-foreground">
              ${summary.walletValueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Lending Positions</p>
            <p className="text-lg font-semibold text-foreground">
              ${summary.suppliedValueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Borrowed</p>
            <p className="text-lg font-semibold text-status-error">
              ${summary.borrowedValueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Net Worth</p>
            <p className="text-lg font-semibold text-primary">
              ${summary.netValueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Net APY */}
        <div className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
          <div className="flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Net APY</span>
          </div>
          <span className={`text-sm font-bold ${
            summary.netAPY >= 0 ? 'text-status-success' : 'text-status-error'
          }`}>
            {summary.netAPY >= 0 ? '+' : ''}{(summary.netAPY * 100).toFixed(2)}%
          </span>
        </div>

        {/* Available Borrowing Power */}
        {summary.availableBorrowUSD > 0 && (
          <div className="p-3 bg-surface-elevated rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Available to Borrow</span>
              <span className="text-sm font-semibold text-primary">
                ${summary.availableBorrowUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}