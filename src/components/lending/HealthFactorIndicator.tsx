import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface HealthFactorIndicatorProps {
  current: number;
  projected?: number;
  showProjected?: boolean;
}

export function HealthFactorIndicator({ current, projected, showProjected = false }: HealthFactorIndicatorProps) {
  const getHealthStatus = (factor: number) => {
    if (factor >= 2.0) return { color: "bg-status-success", text: "Healthy", icon: CheckCircle };
    if (factor >= 1.5) return { color: "bg-status-warning", text: "Moderate", icon: AlertTriangle };
    if (factor >= 1.1) return { color: "bg-status-error", text: "At Risk", icon: AlertTriangle };
    return { color: "bg-destructive", text: "Danger", icon: XCircle };
  };

  const currentStatus = getHealthStatus(current);
  const projectedStatus = projected ? getHealthStatus(projected) : null;

  // Convert health factor to progress percentage (capped at 100)
  const getProgressValue = (factor: number) => Math.min((factor / 3.0) * 100, 100);

  return (
    <Card className="bg-surface-elevated border-border">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Health Factor</span>
            <div className="flex items-center gap-2">
              <currentStatus.icon className="h-4 w-4" />
              <Badge variant="outline" className={`${currentStatus.color} text-white border-none`}>
                {current.toFixed(2)}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Progress 
              value={getProgressValue(current)} 
              className="h-2"
            />
            
            {showProjected && projected && projectedStatus && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">After transaction:</span>
                <div className="flex items-center gap-2">
                  <projectedStatus.icon className="h-4 w-4" />
                  <Badge variant="outline" className={`${projectedStatus.color} text-white border-none`}>
                    {projected.toFixed(2)}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            <div className="flex justify-between mb-1">
              <span>1.0 = Liquidation Risk</span>
              <span>2.0+ = Safe</span>
            </div>
            <p>
              Health factor below 1.0 may trigger liquidation of your collateral.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}