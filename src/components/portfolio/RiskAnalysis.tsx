import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, TrendingUp, Target } from "lucide-react";

interface RiskAssessment {
  overall: 'low' | 'medium' | 'high';
  concentration: number;
  volatility: number;
  liquidation: number;
  marketExposure: number;
  recommendations: string[];
}

interface RiskAnalysisProps {
  riskAssessment: RiskAssessment | null;
  loading?: boolean;
}

export function RiskAnalysis({ riskAssessment, loading }: RiskAnalysisProps) {
  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return "bg-success text-success-foreground";
      case 'medium': return "bg-warning text-warning-foreground";
      case 'high': return "bg-destructive text-destructive-foreground";
    }
  };

  const getRiskIcon = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return <Shield className="h-4 w-4" />;
      case 'medium': return <TrendingUp className="h-4 w-4" />;
      case 'high': return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getRiskDescription = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return "Conservative risk profile with stable exposure";
      case 'medium': return "Moderate risk profile requiring monitoring";
      case 'high': return "Elevated risk requiring immediate attention";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk Analysis
          </CardTitle>
          <CardDescription>
            Portfolio risk assessment and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-10 bg-muted rounded-full w-32 mx-auto"></div>
              <div className="h-4 bg-muted rounded w-3/4 mx-auto mt-2"></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-6 bg-muted rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!riskAssessment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk Analysis
          </CardTitle>
          <CardDescription>
            Portfolio risk assessment and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No risk data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Risk Analysis
        </CardTitle>
        <CardDescription>
          Comprehensive portfolio risk assessment and strategic recommendations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Risk Score */}
        <div className="text-center">
          <Badge className={`${getRiskColor(riskAssessment.overall)} text-lg px-4 py-2`}>
            {getRiskIcon(riskAssessment.overall)}
            <span className="ml-2 capitalize">{riskAssessment.overall} Risk</span>
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">
            {getRiskDescription(riskAssessment.overall)}
          </p>
        </div>

        {/* Risk Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Concentration</span>
              <span className="text-sm font-semibold">
                {riskAssessment.concentration.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Risk from asset concentration
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Volatility</span>
              <span className="text-sm font-semibold">
                {riskAssessment.volatility.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Expected price variation
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Market Exposure</span>
              <span className="text-sm font-semibold">
                {riskAssessment.marketExposure.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Exposure to market movements
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Liquidity</span>
              <span className="text-sm font-semibold">
                {(100 - riskAssessment.liquidation).toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Ease of converting to cash
            </div>
          </div>
        </div>

        {/* High Risk Alert */}
        {riskAssessment.overall === 'high' && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your portfolio shows elevated risk levels. Consider reviewing the recommendations below 
              and implementing risk management strategies.
            </AlertDescription>
          </Alert>
        )}

        {/* Recommendations */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="font-medium">Strategic Recommendations</span>
          </div>
          
          <div className="space-y-2">
            {riskAssessment.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <span className="text-muted-foreground leading-relaxed">{recommendation}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Management Tips */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-sm">Risk Management Best Practices</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Regularly review and rebalance your portfolio</li>
            <li>• Set clear stop-loss levels and stick to them</li>
            <li>• Diversify across different asset classes when possible</li>
            <li>• Keep 10-20% in cash for opportunities and emergencies</li>
            <li>• Stay informed about market conditions and economic factors</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}