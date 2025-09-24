import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb, 
  Target,
  ArrowUpRight,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { AIInsight } from "@/hooks/usePortfolioAI";

interface AIInsightsPanelProps {
  insights: AIInsight[];
  loading: boolean;
  onRefresh: () => void;
}

export function AIInsightsPanel({ insights, loading, onRefresh }: AIInsightsPanelProps) {
  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'recommendation': return Lightbulb;
      case 'warning': return AlertTriangle;
      case 'opportunity': return Target;
      case 'forecast': return TrendingUp;
      default: return Brain;
    }
  };

  const getInsightColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'recommendation': return 'text-info border-info/20 bg-info/10';
      case 'warning': return 'text-warning border-warning/20 bg-warning/10';
      case 'opportunity': return 'text-primary border-primary/20 bg-primary/10';
      case 'forecast': return 'text-accent border-accent/20 bg-accent/10';
      default: return 'text-muted-foreground border-border bg-surface-elevated';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-status-success';
    if (confidence >= 60) return 'text-warning';
    return 'text-status-error';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            AI Portfolio Insights
            <Sparkles className="h-3 w-3 text-primary animate-pulse" />
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-surface-elevated rounded mb-2" />
                <div className="h-3 bg-surface-elevated rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No insights available</p>
            <p className="text-xs">Add assets to get AI recommendations</p>
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {insights.map((insight) => {
                const Icon = getInsightIcon(insight.type);
                return (
                  <div
                    key={insight.id}
                    className={`p-3 border rounded-lg ${getInsightColor(insight.type)}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{insight.title}</h4>
                          <div className="flex items-center gap-1">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getConfidenceColor(insight.confidence)}`}
                            >
                              {insight.confidence}%
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {insight.timeframe}
                            </Badge>
                          </div>
                        </div>
                        
                        <p className="text-sm opacity-90">
                          {insight.description}
                        </p>
                        
                        {insight.actionable && (
                          <div className="bg-background/50 rounded-md p-2 mt-2">
                            <div className="flex items-center gap-1 mb-1">
                              <ArrowUpRight className="h-3 w-3" />
                              <span className="text-xs font-medium">Action</span>
                            </div>
                            <p className="text-xs mb-1">{insight.actionable.action}</p>
                            <p className="text-xs opacity-75">
                              <strong>Impact:</strong> {insight.actionable.impact}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}