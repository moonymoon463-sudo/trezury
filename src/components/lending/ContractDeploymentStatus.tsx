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
  Copy,
  FileText,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useContractDeployment } from "@/hooks/useContractDeployment";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useClientDeployment } from "@/hooks/useClientDeployment";
import { Chain, DeploymentChain } from "@/types/lending";
import { useToast } from "@/hooks/use-toast";
import { WalletFundingInfo } from "@/components/WalletFundingInfo";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DeploymentLog {
  id: string;
  deployment_id: string;
  chain: string;
  operation: string;
  level: string;
  message: string;
  details: any;
  error_data?: any;
  created_at: string;
}

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
  
  const clientDeploymentState = useClientDeployment();

  const [deployingChain, setDeployingChain] = useState<DeploymentChain | null>(null);
  const [gasEstimates, setGasEstimates] = useState<Record<DeploymentChain, string>>({
    ethereum: ""
  });
  const [deployerBalance, setDeployerBalance] = useState<string>("");
  const [deployerAddress, setDeployerAddress] = useState<string>("");
  const [diagnosticsResults, setDiagnosticsResults] = useState<any>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const chains: DeploymentChain[] = ['ethereum'];
  const deployedCount = Object.values(deploymentStatus || {}).filter(Boolean).length;
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

  const fetchLogs = async (chain: string = 'ethereum') => {
    setIsLoadingLogs(true);
    try {
      const { data, error } = await supabase.functions.invoke('contract-deployment', {
        body: { operation: 'get_logs', chain }
      });

      if (error) throw error;

      if (data?.success) {
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      toast({
        title: "Error fetching logs",
        description: "Failed to load deployment logs",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleDeploy = async (chain: DeploymentChain) => {
    // Deployment uses backend deployer; wallet is optional. If connected, try to switch to Sepolia for better UX.
    if (wallet.isConnected && chain === 'ethereum' && wallet.chainId !== 11155111) {
      try {
        await switchNetwork(11155111);
        toast({ title: "Network Switched", description: "Switched to Sepolia for deployment" });
      } catch {
        toast({
          title: "Wrong Network",
          description: "Please switch to Ethereum Sepolia testnet to view on-chain activity",
          variant: "destructive"
        });
        // Proceed with deployment regardless since it's server-side
      }
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

  const handleClientDeploy = async (chain: DeploymentChain) => {
    const success = await clientDeploymentState.deployWithWallet(chain);
    if (success) {
      await checkDeploymentStatus();
      await fetchDeploymentInfo();
    }
  };

  const handleVerify = async (chain: DeploymentChain) => {
    const success = await verifyContracts(chain);
    if (success) {
      await checkDeploymentStatus();
      await fetchDeploymentInfo();
    }
  };

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const { data, error } = await supabase.functions.invoke('contract-deployment', {
        body: { operation: 'diagnose', chain: 'ethereum' }
      });
      
      if (error) throw error;
      
      setDiagnosticsResults(data);
      
      toast({
        title: "Diagnostics Complete",
        description: `Health Score: ${data.healthScore}/100`,
        variant: data.healthScore >= 75 ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Diagnostics failed:', error);
      toast({
        title: "Diagnostics Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    } finally {
      setIsRunningDiagnostics(false);
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
        {/* Deployment Options */}
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
                    <div className="flex gap-2">
                      {/* Server Deployment */}
                      <Button
                        size="sm"
                        onClick={() => handleDeploy(chain)}
                        disabled={isDeploying || deployingChain === chain}
                        className="min-w-[100px]"
                      >
                        {deployingChain === chain ? (
                          "Deploying..."
                        ) : (
                          <>
                            <Rocket className="h-3 w-3 mr-1" />
                            Deploy (Server)
                          </>
                        )}
                      </Button>
                      
                      {/* Client Deployment */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleClientDeploy(chain)}
                        disabled={isDeploying || clientDeploymentState.isDeploying || !wallet.isConnected}
                        className="min-w-[120px]"
                      >
                        {clientDeploymentState.isDeploying ? (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            Deploying...
                          </>
                        ) : (
                          <>
                            <Wallet className="h-3 w-3 mr-1" />
                            Deploy (Wallet)
                          </>
                        )}
                      </Button>
                    </div>
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
          {/* Wallet Status with deployment info */}
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
            <p className="text-xs text-muted-foreground mb-2">
              {wallet.isConnected 
                ? `Connected: ${wallet.address?.substring(0,8)}...` 
                : "Please connect wallet"}
            </p>
            {wallet.isConnected && (
              <div className="space-y-1">
                <p className="text-xs">
                  Balance: {wallet.balance} ETH
                </p>
                {wallet.chainId === 11155111 ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-success" />
                    <span className="text-xs text-success">Ready for wallet deployment</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-warning" />
                    <span className="text-xs text-warning">Switch to Sepolia for wallet deployment</span>
                  </div>
                )}
              </div>
            )}
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

        {/* Diagnostics */}
        <div className="grid gap-3 md:grid-cols-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runDiagnostics}
            disabled={isRunningDiagnostics}
            className="flex items-center gap-2"
          >
            <AlertCircle className="h-3 w-3" />
            {isRunningDiagnostics ? "Running..." : "Run Diagnostics"}
          </Button>
          
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

        {/* Diagnostics Results */}
        {diagnosticsResults && (
          <div className="p-3 rounded-lg border border-border bg-surface-elevated">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                System Diagnostics
              </h4>
              <Badge variant={diagnosticsResults.healthScore >= 75 ? "default" : "destructive"}>
                {diagnosticsResults.healthScore}/100
              </Badge>
            </div>
            
            <div className="space-y-3 text-sm">
              {/* Secrets Status */}
              <div>
                <p className="font-medium mb-1">Secrets Configuration:</p>
                <div className="grid grid-cols-2 gap-1">
                  {diagnosticsResults.secretsStatus && Object.entries(diagnosticsResults.secretsStatus).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-1">
                      {value ? <CheckCircle className="h-3 w-3 text-success" /> : <AlertCircle className="h-3 w-3 text-destructive" />}
                      <span className={value ? "text-success" : "text-destructive"}>
                        {key.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RPC Tests */}
              {diagnosticsResults.rpcTests?.length > 0 && (
                <div>
                  <p className="font-medium mb-1">RPC Connectivity:</p>
                  <div className="space-y-1">
                    {diagnosticsResults.rpcTests.slice(0, 3).map((rpc: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        {rpc.status === 'success' ? 
                          <CheckCircle className="h-3 w-3 text-success" /> : 
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        }
                        <span className={rpc.status === 'success' ? "text-success" : "text-destructive"}>
                          {rpc.url} {rpc.authenticated ? '[AUTH]' : '[PUBLIC]'} 
                          {rpc.latency && ` (${rpc.latency})`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {diagnosticsResults.recommendations?.length > 0 && (
                <div>
                  <p className="font-medium mb-1 text-warning">Recommendations:</p>
                  <ul className="space-y-1">
                    {diagnosticsResults.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="text-xs text-warning flex items-start gap-1">
                        <span className="text-warning">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
        {/* Enhanced Logs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Deployment Logs</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs()}
                disabled={isLoadingLogs}
              >
                Refresh Logs
              </Button>
              <Collapsible open={showLogs} onOpenChange={setShowLogs}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    {showLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {showLogs ? 'Hide' : 'Show'} Logs ({logs.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="max-h-96 overflow-y-auto border rounded-lg bg-muted/10 p-4 space-y-2">
                    {logs.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No logs available</p>
                    ) : (
                      logs.map((log) => (
                        <div
                          key={log.id}
                          className={`p-3 rounded-md text-sm ${
                            log.level === 'error' 
                              ? 'bg-destructive/10 border-destructive/20 border' 
                              : log.level === 'warn'
                              ? 'bg-yellow-500/10 border-yellow-500/20 border'
                              : 'bg-background border border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'secondary' : 'default'}
                                className="text-xs"
                              >
                                {log.level}
                              </Badge>
                              <span className="font-mono text-xs text-muted-foreground">
                                {log.operation}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-foreground mb-2">{log.message}</p>
                          {log.details && Object.keys(log.details || {}).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                View details
                              </summary>
                              <pre className="mt-1 text-xs bg-background/50 p-2 rounded overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                          {log.error_data && (
                            <details className="mt-2">
                              <summary className="text-xs text-destructive cursor-pointer hover:text-destructive/80">
                                View error data
                              </summary>
                              <pre className="mt-1 text-xs bg-destructive/5 p-2 rounded overflow-x-auto text-destructive">
                                {JSON.stringify(log.error_data, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}