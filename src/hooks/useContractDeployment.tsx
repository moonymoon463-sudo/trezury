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
      
      // For demo purposes, use test private key
      const privateKey = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
      const rpcUrl = "https://base-sepolia.g.alchemy.com/v2/demo"; // Base Sepolia testnet
      
      await contractDeploymentService.initialize(privateKey, rpcUrl);
      
      // Check deployment status
      const status = await contractDeploymentService.getDeploymentStatus();
      setDeploymentStatus(status);
    } catch (error) {
      console.error('Failed to initialize contract deployment service:', error);
    }
  };

  const deployToChain = async (chain: Chain) => {
    if (!wallet.isConnected) {
      toast({
        variant: "destructive",
        title: "Wallet Not Connected",
        description: "Please connect your wallet to deploy contracts"
      });
      return false;
    }

    setIsDeploying(true);
    try {
      toast({
        title: "Deploying Contracts",
        description: `Deploying lending protocol contracts to ${chain}...`
      });

      // Call the deployment edge function directly
      const { data, error } = await supabase.functions.invoke('contract-deployment', {
        body: {
          operation: 'deploy',
          chain: chain,
          privateKey: "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318",
          rpcUrl: chain === 'base' 
            ? "https://base-sepolia.g.alchemy.com/v2/demo"
            : "https://eth-sepolia.g.alchemy.com/v2/demo"
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Deployment failed');
      }

      toast({
        title: "Deployment Successful",
        description: `Contracts deployed successfully to ${chain}!`
      });

      // Update deployment status
      setDeploymentStatus(prev => ({ ...prev, [chain]: true }));
      
      return true;
    } catch (error) {
      console.error(`Failed to deploy contracts to ${chain}:`, error);
      toast({
        variant: "destructive",
        title: "Deployment Failed",
        description: `Failed to deploy contracts to ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`
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