import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  Rocket,
  Network,
  Code
} from "lucide-react";
import { useContractDeployment } from "@/hooks/useContractDeployment";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { Chain } from "@/types/lending";
import { useToast } from "@/hooks/use-toast";

export function ContractDeploymentStatus() {
  const { wallet } = useWalletConnection();
  const { toast } = useToast();
  const {
    isDeploying,
    deploymentStatus,
    deployToChain,
    verifyContracts,
    checkDeploymentStatus
  } = useContractDeployment();

  const [deployingChain, setDeployingChain] = useState<Chain | null>(null);

  const chains: Chain[] = ['ethereum', 'base'];
  const deployedCount = Object.values(deploymentStatus).filter(Boolean).length;
  const totalChains = chains.length;
  const deploymentProgress = (deployedCount / totalChains) * 100;

  const handleDeploy = async (chain: Chain) => {
    if (!wallet.isConnected) {
      toast({
        variant: "destructive",
        title: "Wallet Required",
        description: "Please connect your wallet to deploy contracts"
      });
      return;
    }

    setDeployingChain(chain);
    const success = await deployToChain(chain);
    setDeployingChain(null);
    
    if (success) {
      await checkDeploymentStatus();
    }
  };

  const handleVerify = async (chain: Chain) => {
    const success = await verifyContracts(chain);
    if (success) {
      await checkDeploymentStatus();
    }
  };

  const getChainDisplayName = (chain: Chain): string => {
    const names = {
      ethereum: 'Ethereum',
      base: 'Base',
      solana: 'Solana', 
      tron: 'Tron'
    };
    return names[chain] || chain;
  };

  const getChainStatus = (chain: Chain) => {
    const isDeployed = deploymentStatus[chain];
    const isCurrentlyDeploying = deployingChain === chain;

    if (isCurrentlyDeploying) {
      return { variant: "secondary" as const, icon: Clock, text: "Deploying..." };
    }
    if (isDeployed) {
      return { variant: "default" as const, icon: CheckCircle, text: "Deployed" };
    }
    return { variant: "destructive" as const, icon: AlertCircle, text: "Not Deployed" };
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Smart Contract Deployment
        </CardTitle>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Overall Progress</span>
            <span>{deployedCount}/{totalChains} chains</span>
          </div>
          <Progress value={deploymentProgress} className="w-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Deployment Status per Chain */}
        <div className="grid gap-3">
          {chains.map((chain) => {
            const status = getChainStatus(chain);
            const StatusIcon = status.icon;
            
            return (
              <div
                key={chain}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated border border-border"
              >
                <div className="flex items-center gap-3">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium text-foreground">
                      {getChainDisplayName(chain)}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Lending protocol contracts
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge variant={status.variant} className="flex items-center gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {status.text}
                  </Badge>
                  
                  {!deploymentStatus[chain] && (
                    <Button
                      size="sm"
                      onClick={() => handleDeploy(chain)}
                      disabled={!wallet.isConnected || isDeploying || deployingChain === chain}
                      className="min-w-[80px]"
                    >
                      {deployingChain === chain ? (
                        "Deploying..."
                      ) : (
                        "Deploy"
                      )}
                    </Button>
                  )}
                  
                  {deploymentStatus[chain] && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerify(chain)}
                      className="min-w-[80px]"
                    >
                      <Code className="h-3 w-3 mr-1" />
                      Verify
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Wallet Connection Status */}
        {!wallet.isConnected && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              <p className="text-sm text-warning font-medium">
                Connect your wallet to deploy contracts
              </p>
            </div>
          </div>
        )}

        {/* Deployment Complete */}
        {deployedCount === totalChains && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <div>
                <p className="text-sm text-success font-medium">
                  All contracts deployed successfully!
                </p>
                <p className="text-xs text-success/80">
                  You can now use all lending features across all supported chains.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Information */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Deployment creates lending pools for USDC, USDT, DAI, XAUT, and AURU</p>
              <p>• Contracts are deployed to testnets for development</p>
              <p>• Verification makes contracts readable on block explorers</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}