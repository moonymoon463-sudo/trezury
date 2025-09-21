import { useState, useEffect } from "react";
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
  Code,
  Wallet,
  Fuel,
  TrendingUp,
  Eye,
  Copy
} from "lucide-react";
import { useContractDeployment } from "@/hooks/useContractDeployment";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { Chain, DeploymentChain } from "@/types/lending";
import { useToast } from "@/hooks/use-toast";
import { WalletFundingInfo } from "@/components/WalletFundingInfo";
import { supabase } from "@/integrations/supabase/client";

export function ContractDeploymentStatus() {
  const { wallet, switchNetwork, addSepoliaNetwork } = useWalletConnection();
  const { toast } = useToast();
  const {
    isDeploying,
    deploymentStatus,
    deployToChain,
    verifyContracts,
    checkDeploymentStatus
  } = useContractDeployment();

  const [deployingChain, setDeployingChain] = useState<DeploymentChain | null>(null);
  const [gasEstimates, setGasEstimates] = useState<Record<DeploymentChain, string>>({
    ethereum: ""
  });
  const [deployerBalance, setDeployerBalance] = useState<string>("");
  const [deployerAddress, setDeployerAddress] = useState<string>("");

  const chains: DeploymentChain[] = ['ethereum'];
  const deployedCount = Object.values(deploymentStatus).filter(Boolean).length;
  const totalChains = chains.length;
  const deploymentProgress = (deployedCount / totalChains) * 100;

  // Fetch deployment info on component mount
  useEffect(() => {
    fetchDeploymentInfo();
  }, []);

  const fetchDeploymentInfo = async () => {
    try {
      // Get gas estimates and deployer balance
      const { data } = await supabase.functions.invoke('contract-deployment', {
        body: { operation: 'get_deployment_info' }
      });
      
      if (data?.gasEstimates) {
        setGasEstimates(data.gasEstimates);
      }
      if (data?.deployerBalance) {
        setDeployerBalance(data.deployerBalance);
      }
      if (data?.deployerAddress) {
        setDeployerAddress(data.deployerAddress);
      }
    } catch (error) {
      console.error('Failed to fetch deployment info:', error);
    }
  };

  const handleDeploy = async (chain: DeploymentChain) => {
    if (!wallet.isConnected) {
      toast({
        variant: "destructive",
        title: "Wallet Required",
        description: "Please connect your wallet to deploy contracts"
      });
      return;
    }

    // Check if on correct network for Ethereum deployment
    if (chain === 'ethereum' && wallet.chainId !== 11155111) {
      toast({
        title: "Wrong Network",
        description: "Please switch to Ethereum Sepolia testnet for deployment",
        variant: "destructive"
      });
      return;
    }

    setDeployingChain(chain);
    const success = await deployToChain(chain);
    setDeployingChain(null);
    
    if (success) {
      // Refresh deployment status and fetch updated contract addresses
      await checkDeploymentStatus();
      await fetchDeploymentInfo(); // Refresh deployer balance too
    }
  };

  const handleVerify = async (chain: DeploymentChain) => {
    const success = await verifyContracts(chain);
    if (success) {
      await checkDeploymentStatus();
      await fetchDeploymentInfo();
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

        {/* Deployment Requirements */}
        <div className="grid gap-3 md:grid-cols-2">
          {/* Wallet Status */}
          <div className={`p-3 rounded-lg border ${
            wallet.isConnected 
              ? "bg-success/10 border-success/20" 
              : "bg-warning/10 border-warning/20"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className={`h-4 w-4 ${wallet.isConnected ? "text-success" : "text-warning"}`} />
              <p className={`text-sm font-medium ${wallet.isConnected ? "text-success" : "text-warning"}`}>
                Wallet Status
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {wallet.isConnected 
                ? `Connected: ${wallet.address?.substring(0,8)}...` 
                : "Please connect wallet"}
            </p>
          </div>

          {/* Network Status */}
          <div className="p-3 rounded-lg border border-border bg-surface-elevated">
            <div className="flex items-center gap-2 mb-2">
              <Network className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Network Status</p>
            </div>
            {wallet.isConnected ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Current: {wallet.networkName || 'Unknown'}
                </p>
                {wallet.chainId !== 11155111 ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">
                      Wrong Network
                    </Badge>
                    <Button
                      onClick={async () => {
                        try {
                          await switchNetwork(11155111);
                          toast({
                            title: "Network Switched",
                            description: "Successfully switched to Sepolia testnet"
                          });
                        } catch (error) {
                          toast({
                            title: "Network Switch Failed",
                            description: "Please manually switch to Sepolia testnet in your wallet",
                            variant: "destructive"
                          });
                        }
                      }}
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                    >
                      Switch to Sepolia
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-success" />
                    <span className="text-xs text-success">Ready for deployment</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Connect wallet to check network</p>
            )}
          </div>
        </div>

        {/* Deployer Address Info */}
        {deployerAddress && (
          <div className="p-3 rounded-lg border border-border bg-surface-elevated">
            <div className="flex items-center gap-2 mb-2">
              <Code className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Deployer Wallet</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <code className="text-xs bg-surface px-2 py-1 rounded font-mono">
                  {deployerAddress}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(deployerAddress);
                    toast({ title: "Address copied!" });
                  }}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(`https://sepolia.etherscan.io/address/${deployerAddress}`, '_blank')}
                  className="h-6 w-6 p-0"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Balance: {deployerBalance}
              </p>
              {deployerBalance.includes("LOW") && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-warning" />
                  <p className="text-xs text-warning">
                    Fund with Sepolia ETH from: 
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => window.open('https://sepoliafaucet.com/', '_blank')}
                      className="h-auto p-0 ml-1 text-xs text-primary"
                    >
                      sepoliafaucet.com
                    </Button>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wallet Funding Info */}
        <WalletFundingInfo />

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

        {/* View Logs Link */}
        <div className="flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://supabase.com/dashboard/project/auntkvllzejtfqmousxg/functions/contract-deployment/logs', '_blank')}
            className="flex items-center gap-2"
          >
            <Eye className="h-3 w-3" />
            View Deployment Logs
          </Button>
        </div>

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