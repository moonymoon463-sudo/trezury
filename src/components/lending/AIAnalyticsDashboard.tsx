import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Brain, TrendingUp, Target, AlertTriangle, CheckCircle,
  Lightbulb, ArrowRight, BarChart3, PieChart, LineChart,
  Zap, Shield, DollarSign, Activity, RefreshCw
} from "lucide-react";
import { AIAnalyticsService, AIInsight, PortfolioOptimization, MarketPrediction } from "@/services/aiAnalyticsService";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function AIAnalyticsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [optimization, setOptimization] = useState<PortfolioOptimization | null>(null);
  const [predictions, setPredictions] = useState<MarketPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (user) {
      loadAIAnalytics();
    }
  }, [user]);

  const loadAIAnalytics = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const [insightsData, optimizationData, predictionsData] = await Promise.all([
        AIAnalyticsService.generatePortfolioInsights(user.id),
        AIAnalyticsService.optimizePortfolio(user.id),
        AIAnalyticsService.predictMarketMovements(['USDC', 'USDT', 'DAI', 'XAUT'])
      ]);

      setInsights(insightsData);
      setOptimization(optimizationData);
      setPredictions(predictionsData);
      setLastUpdate(new Date());

    } catch (error) {
      console.error('Error loading AI analytics:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load AI analytics"
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalytics = () => {
    loadAIAnalytics();
    toast({
      title: "Analytics Refreshed",
      description: "AI analysis has been updated with latest data"
    });
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'yield_optimization': return <TrendingUp className="h-5 w-5" />;
      case 'risk_warning': return <AlertTriangle className="h-5 w-5" />;
      case 'market_opportunity': return <Target className="h-5 w-5" />;
      case 'rebalancing': return <RefreshCw className="h-5 w-5" />;
      default: return <Lightbulb className="h-5 w-5" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'yield_optimization': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'risk_warning': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'market_opportunity': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'rebalancing': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPredictionIcon = (trend: string) => {
    switch (trend) {
      case 'bullish': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'bearish': return <ArrowRight className="h-4 w-4 text-red-600 rotate-180" />;
      default: return <ArrowRight className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Please sign in to access AI analytics</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-xl border border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
              <Brain className="h-8 w-8 text-primary" />
              AI Analytics
            </h1>
            <p className="text-muted-foreground">
              Advanced insights powered by machine learning and market intelligence
            </p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <p className="text-sm text-muted-foreground">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
            <Button onClick={refreshAnalytics} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* AI Insights Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Lightbulb className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Insights</p>
                <p className="text-xl font-bold">{insights.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Brain className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI Confidence</p>
                <p className="text-xl font-bold">
                  {insights.length > 0 ? 
                    `${(insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length * 100).toFixed(0)}%` 
                    : '0%'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <DollarSign className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Potential Gains</p>
                <p className="text-xl font-bold">
                  ${insights.reduce((sum, i) => sum + (i.estimatedGain || 0), 0).toFixed(0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="optimization">Portfolio Optimization</TabsTrigger>
          <TabsTrigger value="predictions">Market Predictions</TabsTrigger>
          <TabsTrigger value="scenarios">Risk Scenarios</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          <div className="space-y-4">
            {insights.map((insight) => (
              <Card key={insight.id} className="hover:bg-surface-overlay transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getInsightColor(insight.type)}`}>
                        {getInsightIcon(insight.type)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{insight.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={getInsightColor(insight.type)}>
                            {insight.type.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline" className={`${insight.impact === 'high' ? 'border-red-500/20 bg-red-500/10 text-red-600' : 
                            insight.impact === 'medium' ? 'border-orange-500/20 bg-orange-500/10 text-orange-600' :
                            'border-green-500/20 bg-green-500/10 text-green-600'}`}>
                            {insight.impact} impact
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Confidence</p>
                      <p className={`text-lg font-bold ${getConfidenceColor(insight.confidence)}`}>
                        {(insight.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{insight.description}</p>
                  
                  {insight.estimatedGain && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm">
                        Estimated gain: <span className="font-semibold text-green-600">${insight.estimatedGain.toFixed(0)}</span>
                      </span>
                      {insight.timeframe && (
                        <span className="text-sm text-muted-foreground">
                          • {insight.timeframe}
                        </span>
                      )}
                    </div>
                  )}

                  {insight.suggestedActions && insight.suggestedActions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Suggested Actions:</p>
                      <ul className="space-y-1">
                        {insight.suggestedActions.map((action, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {insight.actionable && (
                    <Button size="sm" className="w-fit">
                      <Zap className="h-4 w-4 mr-2" />
                      Take Action
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}

            {insights.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No AI insights available yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      AI will analyze your portfolio and generate insights as you add positions
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          {optimization && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Optimization Recommendation</CardTitle>
                  <CardDescription>
                    AI-powered analysis of your current allocation with improvement suggestions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3">Current Allocation</h4>
                      <div className="space-y-2">
                        {Object.entries(optimization.currentAllocation).map(([asset, amount]) => (
                          <div key={asset} className="flex items-center justify-between">
                            <span className="text-sm">{asset}</span>
                            <span className="font-medium">${amount.toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3">Suggested Allocation</h4>
                      <div className="space-y-2">
                        {Object.entries(optimization.suggestedAllocation).map(([asset, amount]) => (
                          <div key={asset} className="flex items-center justify-between">
                            <span className="text-sm">{asset}</span>
                            <span className="font-medium">${amount.toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Expected Yield Increase</p>
                      <p className="text-lg font-bold text-green-600">+{optimization.expectedYieldIncrease}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Risk Adjustment</p>
                      <p className={`text-lg font-bold ${optimization.riskAdjustment > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {optimization.riskAdjustment > 0 ? '+' : ''}{optimization.riskAdjustment}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">AI Confidence</p>
                      <p className={`text-lg font-bold ${getConfidenceColor(optimization.confidence)}`}>
                        {(optimization.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Recommended Actions</h4>
                    <div className="space-y-2">
                      {optimization.actions.map((action, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={action.action === 'supply' ? 'border-green-500/20 bg-green-500/10 text-green-600' : 'border-red-500/20 bg-red-500/10 text-red-600'}>
                              {action.action}
                            </Badge>
                            <div>
                              <p className="font-medium">{action.asset}</p>
                              <p className="text-sm text-muted-foreground">{action.reason}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${action.amount.toFixed(0)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button className="w-full">
                    <Target className="h-4 w-4 mr-2" />
                    Apply Optimization
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {predictions.map((prediction) => (
              <Card key={prediction.asset}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{prediction.asset} Prediction</CardTitle>
                    <div className="flex items-center gap-2">
                      {getPredictionIcon(prediction.trend)}
                      <span className="text-sm font-medium capitalize">{prediction.trend}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Price</p>
                      <p className="text-xl font-bold">${prediction.currentPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Predicted Price ({prediction.timeframe})</p>
                      <p className="text-xl font-bold">${prediction.predictedPrice.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Price Change</span>
                      <span className={`font-medium ${prediction.priceChangePercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {prediction.priceChangePercent > 0 ? '+' : ''}{prediction.priceChangePercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">AI Confidence</span>
                      <span className={`font-medium ${getConfidenceColor(prediction.confidence)}`}>
                        {(prediction.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Technical Indicators</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span>RSI:</span>
                        <span>{prediction.indicators.rsi.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>MACD:</span>
                        <span>{prediction.indicators.macd.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Volume:</span>
                        <span>{(prediction.indicators.volume / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sentiment:</span>
                        <span>{(prediction.indicators.sentiment * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>

                  <Progress 
                    value={prediction.confidence * 100} 
                    className="h-2"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Risk scenario analysis helps you prepare for potential market events and their impact on your portfolio.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Risk Scenario Analysis</CardTitle>
              <CardDescription>AI-generated stress testing scenarios for your portfolio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Risk scenarios will be available in the next update</p>
                <p className="text-sm text-muted-foreground mt-1">
                  AI will analyze potential market scenarios and their impact on your positions
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}