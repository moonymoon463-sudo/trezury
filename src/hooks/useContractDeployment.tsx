import { useState, useEffect } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { contractDeploymentService } from "@/services/contractDeploymentService";
import { DeploymentChain } from "@/types/lending";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function useContractDeployment() {
  const { wallet } = useWalletConnection();
  const { toast } = useToast();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<Record<DeploymentChain, boolean>>({
    ethereum: false
  });

  // Initialize deployment service when wallet is connected
  useEffect(() => {
    if (wallet.isConnected) {
      initializeService();
    }
  }, [wallet.isConnected]);

  const initializeService = async () => {
    try {
      if (!wallet.isConnected) return;
      
      // First check if edge function is accessible
      const { data: healthCheck, error: healthError } = await supabase.functions.invoke('contract-deployment', {
        body: { operation: 'health_check' }
      });
      
      if (healthError) {
        console.error('Edge function health check failed:', healthError);
        toast({
          variant: "destructive",
          title: "Service Unavailable",
          description: "Contract deployment service is currently unavailable. Please try again later."
        });
        return;
      }
      
      console.log('Edge function health check passed:', healthCheck);
      
      // Check deployment status from edge function
      const status = await contractDeploymentService.getDeploymentStatus();
      setDeploymentStatus(status);
    } catch (error) {
      console.error('Failed to initialize contract deployment service:', error);
      toast({
        variant: "destructive",
        title: "Initialization Failed",
        description: "Failed to connect to deployment service. Please refresh and try again."
      });
    }
  };

  const deployToChain = async (chain: DeploymentChain) => {
    // Deployment uses a backend deployer wallet; user wallet is not required
    setIsDeploying(true);
    try {
      toast({
        title: "Deploying Real Contracts 🚀",
        description: `Deploying smart contracts to ${chain} blockchain with enhanced security...`
      });

      // Import RPC configuration with fallbacks
      const { NETWORK_CONFIGS, RPC_FALLBACKS } = await import("@/contracts/config");
      const primaryRpcUrl = NETWORK_CONFIGS[chain as keyof typeof NETWORK_CONFIGS]?.rpcUrl;
      const fallbackRpcs = RPC_FALLBACKS[chain as keyof typeof RPC_FALLBACKS] || [];

      // Use secure deployment (private key handled securely in edge function)
      console.log(`Invoking contract-deployment function for ${chain}...`);
      const { data, error } = await supabase.functions.invoke('contract-deployment', {
        body: {
          operation: 'deploy',
          chain,
          rpcUrl: primaryRpcUrl,
          fallbackRpcs: fallbackRpcs
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Supabase function invocation error:', error);
        // Handle 404 specifically
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          throw new Error('Contract deployment service is not available. The service may be temporarily down or not deployed. Please contact support.');
        }
        throw new Error(`Service error: ${error.message}`);
      }

      if (!data || !data.success) {
        // Enhanced error messages with deployer address
        let errorMessage = data?.error || 'Deployment failed';
        if (errorMessage.includes("Insufficient ETH")) {
          errorMessage += " Please fund deployer: 0xeDBd9A02dea7b35478e3b2Ee1fd90378346101Cb with Sepolia ETH from faucet: https://sepoliafaucet.com/";
        } else if (errorMessage.includes("network")) {
          errorMessage += ". Please check your internet connection and try again.";
        } else if (errorMessage.includes("all RPCs failed") || errorMessage.includes("RPC")) {
          errorMessage += ". Network connectivity issues detected. Please try again in a moment.";
        }
        throw new Error(errorMessage);
      }

      toast({
        title: "Real Deployment Success! 🎉",
        description: `Contracts deployed to ${chain}! Gas used: ${data.gasUsed || 'Unknown'} | Deployer: ${data.deployer?.substring(0,8)}...`
      });

      // Refresh deployment status to show updated info
      await checkDeploymentStatus();
      setDeploymentStatus(prev => ({ ...prev, [chain]: true }));
      return true;
    } catch (error) {
      console.error(`Real deployment failed for ${chain}:`, error);
      toast({
        variant: "destructive",
        title: "Deployment Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      return false;
    } finally {
      setIsDeploying(false);
    }
  };

  const getContractAddresses = async (chain: DeploymentChain) => {
    try {
      return await contractDeploymentService.getContractAddresses(chain);
    } catch (error) {
      console.error(`Failed to get contract addresses for ${chain}:`, error);
      return null;
    }
  };

  const verifyContracts = async (chain: DeploymentChain) => {
    try {
      const success = await contractDeploymentService.verifyContracts(chain);
      if (success) {
        toast({
          title: "Verification Successful",
          description: `Contracts verified on ${chain}`
        });
      }
      return success;
    } catch (error) {
      console.error(`Failed to verify contracts on ${chain}:`, error);
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: `Failed to verify contracts on ${chain}`
      });
      return false;
    }
  };

  const checkDeploymentStatus = async () => {
    try {
      const status = await contractDeploymentService.getDeploymentStatus();
      setDeploymentStatus(status);
      return status;
    } catch (error) {
      console.error('Failed to check deployment status:', error);
      return {};
    }
  };

  return {
    isDeploying,
    deploymentStatus,
    deployToChain,
    getContractAddresses,
    verifyContracts,
    checkDeploymentStatus,
    initializeService
  };
}