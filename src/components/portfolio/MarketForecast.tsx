import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { MarketForecast as MarketForecastType } from "@/hooks/usePortfolioAI";

interface MarketForecastProps {
  forecasts: MarketForecastType[];
  loading: boolean;
}

export function MarketForecast({ forecasts, loading }: MarketForecastProps) {
  const getAssetIcon = (asset: string) => {
    switch (asset) {
      case 'XAUT': return '🥇';
      case 'USDC': return '💵';
      case 'TRZRY': return '💎';
      default: return '📈';
    }
  };

  const formatPrice = (price: number, asset: string) => {
    if (asset === 'XAUT') {
      return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    return `$${price.toFixed(4)}`;
  };

  const getTimeframeBadge = (timeframe: string) => {
    const colors = {
      '24h': 'bg-status-success/20 text-status-success',
      '7d': 'bg-warning/20 text-warning',
      '30d': 'bg-info/20 text-info'
    };
    return colors[timeframe as keyof typeof colors] || 'bg-surface-elevated';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          AI Market Forecasts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-surface-elevated rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-surface-elevated rounded mb-1" />
                    <div className="h-3 bg-surface-elevated rounded w-2/3" />
                  </div>
                </div>
                <div className="h-2 bg-surface-elevated rounded mb-2" />
                <div className="h-3 bg-surface-elevated rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : forecasts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No forecasts available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {forecasts.map((forecast, index) => {
              const priceChange = forecast.predictedPrice - forecast.currentPrice;
              const percentChange = (priceChange / forecast.currentPrice) * 100;
              const isPositive = priceChange >= 0;

              return (
                <div key={index} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{getAssetIcon(forecast.asset)}</div>
                      <div>
                        <h4 className="font-medium text-sm">{forecast.asset}</h4>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getTimeframeBadge(forecast.timeframe)}`}
                          >
                            {forecast.timeframe}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {forecast.confidence}% confidence
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        {isPositive ? (
                          <ArrowUpRight className="h-4 w-4 text-status-success" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-status-error" />
                        )}
                        <span className={`text-sm font-bold ${
                          isPositive ? 'text-status-success' : 'text-status-error'
                        }`}>
                          {isPositive ? '+' : ''}{percentChange.toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(forecast.currentPrice, forecast.asset)} → {formatPrice(forecast.predictedPrice, forecast.asset)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Confidence</span>
                      <span className="font-medium">{forecast.confidence}%</span>
                    </div>
                    <Progress 
                      value={forecast.confidence} 
                      className="h-1"
                    />
                  </div>

                  <div className="mt-3 p-2 bg-surface-elevated rounded-md">
                    <p className="text-xs text-muted-foreground mb-1">AI Analysis</p>
                    <p className="text-xs">{forecast.reasoning}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}