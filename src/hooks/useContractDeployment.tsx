import { useState, useEffect } from "react";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { contractDeploymentService } from "@/services/contractDeploymentService";
import { Chain } from "@/types/lending";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function useContractDeployment() {
  const { wallet } = useWalletConnection();
  const { toast } = useToast();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<Record<Chain, boolean>>({
    ethereum: false,
    base: false,
    solana: false,
    tron: false
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

  const deployToChain = async (chain: Chain) => {
    if (!wallet.isConnected) {
      toast({
        variant: "destructive", 
        title: "Wallet Required",
        description: "Please connect your wallet first"
      });
      return false;
    }

    setIsDeploying(true);
    try {
      toast({
        title: "Deploying Real Contracts 🚀",
        description: `Deploying smart contracts to ${chain} blockchain with enhanced security...`
      });

      // Get RPC URLs for real testnets
      const rpcUrls = {
        ethereum: "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
        base: "https://sepolia.base.org", 
        solana: "https://api.devnet.solana.com",
        tron: "https://api.trongrid.io"
      };

      // Use secure deployment (private key handled securely in edge function)
      console.log(`Invoking contract-deployment function for ${chain}...`);
      
      const { data, error } = await supabase.functions.invoke('contract-deployment', {
        body: {
          operation: 'deploy',
          chain,
          rpcUrl: rpcUrls[chain]
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
        // Enhanced error messages
        let errorMessage = data?.error || 'Deployment failed';
        if (errorMessage.includes("Insufficient ETH")) {
          errorMessage += ". Please fund the deployment wallet or contact support.";
        } else if (errorMessage.includes("network")) {
          errorMessage += ". Please check your internet connection and try again.";
        }
        throw new Error(errorMessage);
      }

      toast({
        title: "Real Deployment Success! 🎉",
        description: `Contracts deployed to ${chain}! Gas used: ${data.gasUsed || 'Unknown'} | Deployer: ${data.deployer?.substring(0,8)}...`
      });

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

  const getContractAddresses = async (chain: Chain) => {
    try {
      return await contractDeploymentService.getContractAddresses(chain);
    } catch (error) {
      console.error(`Failed to get contract addresses for ${chain}:`, error);
      return null;
    }
  };

  const verifyContracts = async (chain: Chain) => {
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