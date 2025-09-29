import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  BarChart3,
  Target,
  Zap
} from "lucide-react";
import { RiskAssessment } from "@/hooks/usePortfolioAI";

interface RiskAnalysisProps {
  riskAssessment: RiskAssessment | null;
  loading: boolean;
}

export function RiskAnalysis({ riskAssessment, loading }: RiskAnalysisProps) {
  const getRiskColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return 'text-status-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-status-error';
      default: return 'text-muted-foreground';
    }
  };

  const getRiskIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return CheckCircle;
      case 'medium': return AlertTriangle;
      case 'high': return AlertTriangle;
      default: return Shield;
    }
  };

  const getRiskBadgeVariant = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      default: return 'outline';
    }
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'concentration': return Target;
      case 'volatility': return BarChart3;
      case 'liquidation': return AlertTriangle;
      case 'marketExposure': return TrendingUp;
      default: return Zap;
    }
  };

  const formatMetricName = (metric: string) => {
    switch (metric) {
      case 'concentration': return 'Concentration Risk';
      case 'volatility': return 'Portfolio Volatility';
      case 'liquidation': return 'Liquidation Risk';
      case 'marketExposure': return 'Market Exposure';
      default: return metric;
    }
  };

  const getMetricRiskLevel = (metric: string, value: number): 'low' | 'medium' | 'high' => {
    switch (metric) {
      case 'concentration':
        return value > 70 ? 'high' : value > 50 ? 'medium' : 'low';
      case 'volatility':
        return value > 25 ? 'high' : value > 15 ? 'medium' : 'low';
      case 'liquidation':
        return value > 20 ? 'high' : value > 5 ? 'medium' : 'low';
      case 'marketExposure':
        return value > 80 ? 'high' : value > 60 ? 'medium' : 'low';
      default:
        return 'low';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-4 w-4 text-primary" />
            Risk Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-surface-elevated rounded mb-2" />
              <div className="h-2 bg-surface-elevated rounded mb-3" />
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-3 bg-surface-elevated rounded" />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!riskAssessment) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-4 w-4 text-primary" />
            Risk Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No risk data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const RiskIcon = getRiskIcon(riskAssessment.overall);
  const riskMetrics = [
    { key: 'concentration', value: riskAssessment.concentration },
    { key: 'volatility', value: riskAssessment.volatility },
    { key: 'liquidation', value: riskAssessment.liquidation },
    { key: 'marketExposure', value: riskAssessment.marketExposure }
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-4 w-4 text-primary" />
          Risk Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Risk Score */}
        <div className="text-center p-4 bg-surface-elevated rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-2">
            <RiskIcon className={`h-5 w-5 ${getRiskColor(riskAssessment.overall)}`} />
            <span className="text-lg font-bold">Overall Risk</span>
          </div>
          <Badge 
            variant={getRiskBadgeVariant(riskAssessment.overall)}
            className="text-sm"
          >
            {riskAssessment.overall.toUpperCase()}
          </Badge>
        </div>

        {/* Risk Metrics */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Risk Breakdown</h4>
          {riskMetrics.map((metric) => {
            const Icon = getMetricIcon(metric.key);
            const riskLevel = getMetricRiskLevel(metric.key, metric.value);
            
            return (
              <div key={metric.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatMetricName(metric.key)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {metric.value.toFixed(1)}%
                    </span>
                    <Badge 
                      variant={getRiskBadgeVariant(riskLevel)}
                      className="text-xs"
                    >
                      {riskLevel}
                    </Badge>
                  </div>
                </div>
                <Progress 
                  value={metric.value} 
                  className={`h-2 ${
                    riskLevel === 'high' ? '[&>div]:bg-status-error' :
                    riskLevel === 'medium' ? '[&>div]:bg-warning' :
                    '[&>div]:bg-status-success'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Recommendations */}
        {riskAssessment.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">AI Recommendations</h4>
            <div className="space-y-2">
              {riskAssessment.recommendations.map((recommendation, index) => (
                <Alert key={index} className="py-2">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {recommendation}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}