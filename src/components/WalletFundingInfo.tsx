import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DeploymentInfo {
  deployerAddress: string;
  deployerBalance: string;
  gasEstimates: Record<string, string>;
}

export function WalletFundingInfo() {
  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDeploymentInfo();
  }, []);

  const fetchDeploymentInfo = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('contract-deployment', {
        body: { operation: 'get_deployment_info' }
      });

      if (error) throw error;
      if (data.success) {
        setDeploymentInfo({
          deployerAddress: data.deployerAddress,
          deployerBalance: data.deployerBalance,
          gasEstimates: data.gasEstimates
        });
      }
    } catch (error) {
      console.error('Failed to fetch deployment info:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (deploymentInfo?.deployerAddress) {
      navigator.clipboard.writeText(deploymentInfo.deployerAddress);
      toast({
        title: "Copied!",
        description: "Wallet address copied to clipboard"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Wallet Info...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!deploymentInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wallet Configuration Required</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load deployment wallet information.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Deployment Wallet
          <Badge variant="outline">Your Wallet</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Address</p>
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <code className="text-sm flex-1">{deploymentInfo.deployerAddress}</code>
            <Button size="sm" variant="ghost" onClick={copyAddress}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a
                href={`https://sepolia.etherscan.io/address/${deploymentInfo.deployerAddress}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
        
        <div>
          <p className="text-sm font-medium mb-2">Current Balance</p>
          <Badge variant={deploymentInfo.deployerBalance?.includes("0.0") ? "destructive" : "default"}>
            {deploymentInfo.deployerBalance || "Loading..."}
          </Badge>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Required Funding</p>
          <div className="grid grid-cols-2 gap-2">
            {deploymentInfo.gasEstimates && Object.entries(deploymentInfo.gasEstimates).map(([chain, estimate]) => (
              <div key={chain} className="flex justify-between text-sm">
                <span className="capitalize">{chain}:</span>
                <span className="text-muted-foreground">{estimate}</span>
              </div>
            ))}
            {!deploymentInfo.gasEstimates && (
              <div className="text-sm text-muted-foreground">No estimates available</div>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Fund your wallet:</strong> Send 0.05-0.10 Sepolia ETH to the address above to enable deployments.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}