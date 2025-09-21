import React from "react";
import { useRiskManagement } from "@/hooks/useRiskManagement";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  TrendingUp, 
  Shield, 
  Target,
  DollarSign,
  Activity,
  X
} from "lucide-react";

export function RiskManagementDashboard() {
  const {
    riskMetrics,
    riskAlerts,
    loading,
    acknowledgeAlert,
    formatHealthFactor,
    formatUsdAmount
  } = useRiskManagement();

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'safe': return 'text-emerald-600';
      case 'warning': return 'text-yellow-600';
      case 'danger': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-neutral-600';
    }
  };

  const getRiskBadgeVariant = (riskLevel: string) => {
    switch (riskLevel) {
      case 'safe': return 'default';
      case 'warning': return 'secondary';
      case 'danger': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <Activity className="h-4 w-4 text-yellow-500" />;
      default: return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
                <div className="h-8 bg-neutral-200 rounded w-3/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Risk Alerts */}
      {riskAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Risk Alerts ({riskAlerts.length})
          </h3>
          {riskAlerts.map((alert) => (
            <Alert key={alert.id} className="border-red-200 bg-red-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getAlertIcon(alert.severity)}
                  <div className="space-y-1">
                    <AlertTitle className="text-sm font-medium">
                      {alert.alert_type.replace('_', ' ').toUpperCase()}
                      <Badge variant="outline" className="ml-2 text-xs">
                        {alert.severity}
                      </Badge>
                    </AlertTitle>
                    <AlertDescription className="text-sm">
                      {alert.message}
                    </AlertDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="text-neutral-500 hover:text-neutral-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Alert>
          ))}
        </div>
      )}

      {/* Risk Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health Factor */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Factor</CardTitle>
            <Shield className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatHealthFactor(riskMetrics.healthFactor)}
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant={getRiskBadgeVariant(riskMetrics.riskLevel)}>
                {riskMetrics.riskLevel.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              {riskMetrics.healthFactor && riskMetrics.healthFactor < 1.0 
                ? "Below 1.0 = Liquidation eligible"
                : "Above 1.0 = Safe from liquidation"
              }
            </p>
          </CardContent>
        </Card>

        {/* Liquidation Risk */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liquidation Risk</CardTitle>
            <Target className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {riskMetrics.liquidationRisk}%
            </div>
            <Progress 
              value={riskMetrics.liquidationRisk} 
              className="h-2 mb-2"
            />
            <p className={`text-sm font-medium ${getRiskColor(riskMetrics.riskLevel)}`}>
              {riskMetrics.riskLevel === 'safe' && "Low Risk"}
              {riskMetrics.riskLevel === 'warning' && "Moderate Risk"}
              {riskMetrics.riskLevel === 'danger' && "High Risk"}
              {riskMetrics.riskLevel === 'critical' && "Critical Risk"}
            </p>
          </CardContent>
        </Card>

        {/* Total Position Value */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Position Overview</CardTitle>
            <DollarSign className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-500">Collateral:</span>
                <span className="text-sm font-medium">
                  {formatUsdAmount(riskMetrics.totalCollateral)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-500">Debt:</span>
                <span className="text-sm font-medium">
                  {formatUsdAmount(riskMetrics.totalDebt)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Net Value:</span>
                <span className="text-sm font-bold">
                  {formatUsdAmount(riskMetrics.totalCollateral - riskMetrics.totalDebt)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Risk Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Risk Analysis & Recommendations
          </CardTitle>
          <CardDescription>
            Monitor your position health and follow recommendations to maintain optimal risk levels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {riskMetrics.healthFactor === null ? (
            <div className="text-center py-8 text-neutral-500">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active positions found</p>
              <p className="text-sm">Start supplying or borrowing assets to see risk metrics</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Risk Level Explanation */}
              <div className="p-4 border rounded-lg bg-neutral-50">
                <h4 className="font-medium mb-2">Current Risk Assessment</h4>
                <p className="text-sm text-neutral-600 mb-3">
                  {riskMetrics.riskLevel === 'safe' && 
                    "Your position is healthy with low liquidation risk. You have room to increase leverage if desired."
                  }
                  {riskMetrics.riskLevel === 'warning' && 
                    "Your position has moderate risk. Monitor market conditions and consider reducing leverage during volatility."
                  }
                  {riskMetrics.riskLevel === 'danger' && 
                    "Your position is at high risk of liquidation. Consider reducing borrowed amounts or adding more collateral."
                  }
                  {riskMetrics.riskLevel === 'critical' && 
                    "URGENT: Your position may be liquidated soon. Take immediate action to improve your health factor."
                  }
                </p>
                
                {/* Action Items */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">Recommended Actions:</h5>
                  <ul className="text-sm text-neutral-600 space-y-1 ml-4">
                    {riskMetrics.riskLevel === 'critical' && (
                      <>
                        <li>• Repay part of your borrowed assets immediately</li>
                        <li>• Add more collateral to your position</li>
                        <li>• Monitor your position every few minutes</li>
                      </>
                    )}
                    {riskMetrics.riskLevel === 'danger' && (
                      <>
                        <li>• Consider repaying some borrowed assets</li>
                        <li>• Add additional collateral if possible</li>
                        <li>• Set up price alerts for your collateral assets</li>
                      </>
                    )}
                    {riskMetrics.riskLevel === 'warning' && (
                      <>
                        <li>• Monitor your position daily</li>
                        <li>• Prepare to act if market conditions worsen</li>
                        <li>• Consider setting position limits</li>
                      </>
                    )}
                    {riskMetrics.riskLevel === 'safe' && (
                      <>
                        <li>• Your position is healthy</li>
                        <li>• Continue monitoring regularly</li>
                        <li>• Consider your investment strategy goals</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>

              {/* Health Factor Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 border rounded bg-emerald-50">
                  <h5 className="font-medium text-emerald-800 mb-1">Safe Zone</h5>
                  <p className="text-sm text-emerald-600">Health Factor ≥ 1.5</p>
                </div>
                <div className="p-3 border rounded bg-red-50">
                  <h5 className="font-medium text-red-800 mb-1">Liquidation Zone</h5>
                  <p className="text-sm text-red-600">Health Factor &lt; 1.0</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}