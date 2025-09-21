import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertTriangle, TrendingUp } from "lucide-react";
import { PortfolioSummary } from "@/hooks/usePortfolioMonitoring";

interface HealthMonitorCardProps {
  summary: PortfolioSummary;
}

export function HealthMonitorCard({ summary }: HealthMonitorCardProps) {
  const { healthFactor, totalCollateralUSD, borrowedValueUSD, availableBorrowUSD } = summary;
  
  // Health factor status
  const getHealthStatus = (factor: number) => {
    if (factor >= 2.0) return { status: 'Healthy', color: 'text-status-success', bgColor: 'bg-status-success/10' };
    if (factor >= 1.5) return { status: 'Moderate', color: 'text-status-warning', bgColor: 'bg-status-warning/10' };
    if (factor >= 1.1) return { status: 'At Risk', color: 'text-status-error', bgColor: 'bg-status-error/10' };
    return { status: 'Danger', color: 'text-status-error', bgColor: 'bg-status-error/20' };
  };

  const healthStatus = getHealthStatus(healthFactor);
  
  // Calculate utilization ratio
  const utilizationRatio = totalCollateralUSD > 0 
    ? (borrowedValueUSD / (totalCollateralUSD * 0.8)) * 100 
    : 0;

  // Don't show if no lending positions
  if (totalCollateralUSD === 0 && borrowedValueUSD === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Health Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Factor Display */}
        <div className="text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${healthStatus.bgColor}`}>
            <div className={`w-2 h-2 rounded-full ${healthStatus.color.replace('text-', 'bg-')}`} />
            <span className={`text-sm font-medium ${healthStatus.color}`}>
              {healthStatus.status}
            </span>
          </div>
          <p className="text-2xl font-bold mt-2">
            {healthFactor > 0 ? healthFactor.toFixed(2) : '∞'}
          </p>
          <p className="text-xs text-muted-foreground">Health Factor</p>
        </div>

        {/* Borrowing Utilization */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Borrowing Power Used</span>
            <span className="font-medium">{utilizationRatio.toFixed(1)}%</span>
          </div>
          <Progress 
            value={Math.min(utilizationRatio, 100)} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>${borrowedValueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} borrowed</span>
            <span>${(totalCollateralUSD * 0.8).toLocaleString('en-US', { maximumFractionDigits: 0 })} max</span>
          </div>
        </div>

        {/* Alerts */}
        {healthFactor < 1.5 && healthFactor > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {healthFactor < 1.1 
                ? "Warning: Your position is at risk of liquidation. Consider repaying debt or adding collateral."
                : "Your health factor is moderate. Monitor your position closely."
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Available Borrowing Power */}
        {availableBorrowUSD > 0 && (
          <div className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Available to Borrow</span>
            </div>
            <span className="text-sm font-bold text-primary">
              ${availableBorrowUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}

        {/* Liquidation Info */}
        <div className="text-xs text-muted-foreground text-center">
          Liquidation occurs when health factor drops below 1.0
        </div>
      </CardContent>
    </Card>
  );
}