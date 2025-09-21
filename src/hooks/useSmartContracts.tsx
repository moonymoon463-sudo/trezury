import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { smartContractService } from "@/services/smartContractService";
import { contractDeploymentService } from "@/services/contractDeploymentService";
import { Chain, Token } from "@/types/lending";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useToast } from "@/hooks/use-toast";
import { ethers } from "ethers";

export function useSmartContracts() {
  const { wallet } = useWalletConnection();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize smart contract service when wallet is connected
  const initializeContracts = async () => {
    if (!wallet.isConnected || !wallet.address) {
      throw new Error("Wallet not connected");
    }
    
    // Create provider and signer from wallet connection
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    await smartContractService.initialize(provider, signer);
  };

  // Query for deployment status across all chains
  const { data: deploymentStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['contract-deployment-status'],
    queryFn: () => contractDeploymentService.getDeploymentStatus(),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Query for contract addresses on a specific chain
  const useContractAddresses = (chain: Chain) => {
    return useQuery({
      queryKey: ['contract-addresses', chain],
      queryFn: () => contractDeploymentService.getContractAddresses(chain),
      enabled: !!chain
    });
  };

  // Supply mutation
  const supplyMutation = useMutation({
    mutationFn: async ({ 
      chain, 
      token, 
      amount 
    }: { 
      chain: Chain; 
      token: Token; 
      amount: string; 
    }) => {
      if (!wallet.address) throw new Error("Wallet not connected");
      
      await initializeContracts();
      return smartContractService.supply(chain, token, amount, wallet.address!);
    },
    onSuccess: (transaction, variables) => {
      toast({
        title: "Supply Successful",
        description: `Supplied ${variables.amount} ${variables.token} to ${variables.chain}`
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['user-account-data'] });
      queryClient.invalidateQueries({ queryKey: ['reserve-data'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Supply Failed",
        description: error instanceof Error ? error.message : "Transaction failed"
      });
    }
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: async ({ 
      chain, 
      token, 
      amount 
    }: { 
      chain: Chain; 
      token: Token; 
      amount: string; 
    }) => {
      if (!wallet.address) throw new Error("Wallet not connected");
      
      await initializeContracts();
      return smartContractService.withdraw(chain, token, amount, wallet.address!);
    },
    onSuccess: (transaction, variables) => {
      toast({
        title: "Withdraw Successful", 
        description: `Withdrew ${variables.amount} ${variables.token} from ${variables.chain}`
      });
      
      queryClient.invalidateQueries({ queryKey: ['user-account-data'] });
      queryClient.invalidateQueries({ queryKey: ['reserve-data'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Withdraw Failed",
        description: error instanceof Error ? error.message : "Transaction failed"
      });
    }
  });

  // Borrow mutation
  const borrowMutation = useMutation({
    mutationFn: async ({ 
      chain, 
      token, 
      amount,
      interestRateMode = 2
    }: { 
      chain: Chain; 
      token: Token; 
      amount: string;
      interestRateMode?: 1 | 2;
    }) => {
      if (!wallet.address) throw new Error("Wallet not connected");
      
      await initializeContracts();
      return smartContractService.borrow(chain, token, amount, wallet.address!, interestRateMode);
    },
    onSuccess: (transaction, variables) => {
      toast({
        title: "Borrow Successful",
        description: `Borrowed ${variables.amount} ${variables.token} from ${variables.chain}`
      });
      
      queryClient.invalidateQueries({ queryKey: ['user-account-data'] });
      queryClient.invalidateQueries({ queryKey: ['reserve-data'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Borrow Failed",
        description: error instanceof Error ? error.message : "Transaction failed"
      });
    }
  });

  // Repay mutation
  const repayMutation = useMutation({
    mutationFn: async ({ 
      chain, 
      token, 
      amount,
      rateMode = 2
    }: { 
      chain: Chain; 
      token: Token; 
      amount: string;
      rateMode?: 1 | 2;
    }) => {
      if (!wallet.address) throw new Error("Wallet not connected");
      
      await initializeContracts();
      return smartContractService.repay(chain, token, amount, wallet.address!, rateMode);
    },
    onSuccess: (transaction, variables) => {
      toast({
        title: "Repay Successful",
        description: `Repaid ${variables.amount} ${variables.token} to ${variables.chain}`
      });
      
      queryClient.invalidateQueries({ queryKey: ['user-account-data'] });
      queryClient.invalidateQueries({ queryKey: ['reserve-data'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Repay Failed",
        description: error instanceof Error ? error.message : "Transaction failed"
      });
    }
  });

  // Query user account data
  const useUserAccountData = (chain: Chain) => {
    return useQuery({
      queryKey: ['user-account-data', chain, wallet.address],
      queryFn: async () => {
        if (!wallet.address) throw new Error("Wallet not connected");
        
        await initializeContracts();
        return smartContractService.getUserAccountData(chain, wallet.address);
      },
      enabled: !!wallet.address && !!chain && wallet.isConnected,
      refetchInterval: 30000
    });
  };

  // Query reserve data for a token
  const useReserveData = (chain: Chain, token: Token) => {
    return useQuery({
      queryKey: ['reserve-data', chain, token],
      queryFn: async () => {
        await initializeContracts();
        return smartContractService.getReserveData(chain, token);
      },
      enabled: !!chain && !!token,
      refetchInterval: 60000
    });
  };

  // Gas estimation
  const estimateGas = async (
    chain: Chain,
    operation: 'supply' | 'withdraw' | 'borrow' | 'repay',
    token: Token,
    amount: string
  ) => {
    if (!wallet.address) throw new Error("Wallet not connected");
    
    await initializeContracts();
    return smartContractService.estimateGas(chain, operation, token, amount, wallet.address);
  };

  return {
    // Deployment status
    deploymentStatus,
    statusLoading,
    useContractAddresses,
    
    // Mutations
    supply: supplyMutation.mutate,
    withdraw: withdrawMutation.mutate,
    borrow: borrowMutation.mutate,
    repay: repayMutation.mutate,
    
    // Mutation states
    isSupplying: supplyMutation.isPending,
    isWithdrawing: withdrawMutation.isPending,
    isBorrowing: borrowMutation.isPending,
    isRepaying: repayMutation.isPending,
    
    // Queries
    useUserAccountData,
    useReserveData,
    
    // Utilities
    estimateGas,
    isContractDeployed: (chain: Chain) => smartContractService.isDeployedOnChain(chain),
    getContractAddresses: (chain: Chain) => smartContractService.getContractAddresses(chain)
  };
}