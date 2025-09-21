import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Loader2,
  ExternalLink,
  TrendingUp
} from "lucide-react";

interface DeploymentStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  details?: string;
  txHash?: string;
  gasUsed?: number;
}

interface EnhancedDeploymentFeedbackProps {
  steps: DeploymentStep[];
  currentStep: number;
  totalSteps: number;
  chain: string;
}

export function EnhancedDeploymentFeedback({
  steps,
  currentStep,
  totalSteps,
  chain
}: EnhancedDeploymentFeedbackProps) {
  const progress = (currentStep / totalSteps) * 100;

  const getStatusIcon = (status: DeploymentStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: DeploymentStep['status']) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'running':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-4">
        {/* Progress Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              Deploying to {chain}
            </span>
            <span className="text-muted-foreground">
              {currentStep}/{totalSteps} steps
            </span>
          </div>
          <Progress value={progress} className="w-full h-2" />
        </div>

        {/* Deployment Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-start gap-3 p-2 rounded-lg bg-surface-elevated"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(step.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-foreground">
                    {step.name}
                  </p>
                  <Badge variant={getStatusColor(step.status)} className="text-xs">
                    {step.status}
                  </Badge>
                </div>
                
                {step.details && (
                  <p className="text-xs text-muted-foreground mb-1">
                    {step.details}
                  </p>
                )}

                {step.gasUsed && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span>Gas used: {step.gasUsed.toLocaleString()}</span>
                  </div>
                )}

                {step.txHash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${step.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View transaction
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        {currentStep === totalSteps && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-success">
                All contracts deployed successfully!
              </span>
              <span className="text-muted-foreground">
                Total gas: {steps.reduce((acc, step) => acc + (step.gasUsed || 0), 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}