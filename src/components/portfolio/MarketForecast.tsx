import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Clock, BarChart3 } from "lucide-react";

interface MarketForecast {
  asset: string;
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  timeframe: string;
  reasoning: string;
}

interface MarketForecastProps {
  forecasts: MarketForecast[];
  loading?: boolean;
}

export function MarketForecast({ forecasts, loading }: MarketForecastProps) {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return "bg-success text-success-foreground";
    if (confidence >= 50) return "bg-warning text-warning-foreground";
    return "bg-destructive text-destructive-foreground";
  };

  const getPredictionTrend = (prediction: number, current: number) => {
    const change = ((prediction - current) / current) * 100;
    return {
      direction: change > 0 ? 'up' : 'down',
      percentage: Math.abs(change),
      isPositive: change > 0
    };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Market Forecasts
          </CardTitle>
          <CardDescription>
            AI-powered price predictions and market analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-6 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-full"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!forecasts || forecasts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Market Forecasts
          </CardTitle>
          <CardDescription>
            AI-powered price predictions and market analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No forecast data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Market Forecasts
        </CardTitle>
        <CardDescription>
          AI-powered price predictions based on technical and fundamental analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {forecasts.map((forecast, index) => {
          const trend = getPredictionTrend(forecast.predictedPrice, forecast.currentPrice);
          
          return (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-medium">
                    {forecast.asset}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {forecast.timeframe}
                  </div>
                </div>
                <Badge className={getConfidenceColor(forecast.confidence)}>
                  {forecast.confidence}% confidence
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">
                    ${forecast.predictedPrice.toFixed(2)}
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${trend.isPositive ? 'text-success' : 'text-destructive'}`}>
                    {trend.isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {trend.isPositive ? '+' : '-'}{trend.percentage.toFixed(1)}%
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div>Current: ${forecast.currentPrice.toFixed(2)}</div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground leading-relaxed">
                {forecast.reasoning}
              </div>
            </div>
          );
        })}

        <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
          <strong>Disclaimer:</strong> These forecasts are AI-generated predictions based on historical data and current market conditions. 
          They should not be considered as financial advice. Always conduct your own research and consider your risk tolerance before making investment decisions.
        </div>
      </CardContent>
    </Card>
  );
}