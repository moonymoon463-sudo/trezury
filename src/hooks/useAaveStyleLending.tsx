import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSmartContracts } from "@/hooks/useSmartContracts";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { 
  PoolReserve, 
  UserSupply, 
  UserBorrow, 
  UserHealthFactor 
} from "@/services/aaveStyleLendingService";
import { useToast } from "@/hooks/use-toast";
import { Chain, Token } from "@/types/lending";

export function useAaveStyleLending() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { wallet } = useWalletConnection();
  const {
    deploymentStatus,
    useUserAccountData,
    useReserveData,
    isContractDeployed,
    getContractAddresses
  } = useSmartContracts();
  
  const [poolReserves, setPoolReserves] = useState<PoolReserve[]>([]);
  const [userSupplies, setUserSupplies] = useState<UserSupply[]>([]);
  const [userBorrows, setUserBorrows] = useState<UserBorrow[]>([]);
  const [userHealthFactor, setUserHealthFactor] = useState<UserHealthFactor | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Deploy contracts if not deployed
  useEffect(() => {
    const deployContracts = async () => {
      if (!wallet.isConnected) return;
      
      try {
        const chains: Chain[] = ['ethereum'];
        for (const chain of chains) {
          const isDeployed = await isContractDeployed(chain);
          if (!isDeployed) {
            toast({
              title: "Deploying Contracts",
              description: `Deploying lending contracts on ${chain}...`
            });
          }
        }
      } catch (error) {
        console.error('Contract deployment check failed:', error);
      }
    };
    
    deployContracts();
  }, [wallet.isConnected, isContractDeployed, toast]);

  const fetchPoolReserves = useCallback(async () => {
    try {
      if (!wallet.isConnected || !deploymentStatus?.ethereum) return;
      
      // For now, create mock pool reserves data since smart contracts aren't fully integrated
      const chains: Chain[] = ['ethereum'];
      const tokens: Token[] = ['USDC', 'USDT', 'DAI', 'XAUT', 'AURU'];
      const reserves: PoolReserve[] = [];
      
      for (const chain of chains) {
        for (const token of tokens) {
            reserves.push({
              id: `${chain}-${token}`,
              asset: token,
              chain,
              supply_rate: 0.045 + Math.random() * 0.02, // 4.5-6.5% APY
              borrow_rate_variable: 0.065 + Math.random() * 0.02, // 6.5-8.5% APY
              borrow_rate_stable: 0.075 + Math.random() * 0.01, // 7.5-8.5% APY
              total_supply_dec: 1000000 + Math.random() * 5000000,
              total_borrowed_dec: 500000 + Math.random() * 2000000,
              available_liquidity_dec: 800000 + Math.random() * 1000000,
              utilization_rate: 0.4 + Math.random() * 0.4, // 40-80%
              ltv: 0.8,
              liquidation_threshold: 0.85,
              liquidation_bonus: 0.05,
              is_active: true,
              borrowing_enabled: true
            });
        }
      }
      
      setPoolReserves(reserves);
    } catch (error) {
      console.error('Error fetching pool reserves:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch pool data"
      });
    }
  }, [toast, wallet.isConnected, deploymentStatus]);

  const fetchUserData = useCallback(async () => {
    if (!user || !wallet.isConnected || !deploymentStatus?.ethereum) return;
    
    try {
      setLoading(true);
      
      // For demo purposes, create mock user data
      // In a real implementation, this would query the smart contracts
      setUserSupplies([]);
      setUserBorrows([]);
      setUserHealthFactor({
        user_id: user.id,
        chain: 'ethereum',
        health_factor: 2.5,
        total_collateral_usd: 0,
        total_debt_usd: 0,
        available_borrow_usd: 0,
        ltv: 0,
        liquidation_threshold: 0.85
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch your lending data"
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, wallet.isConnected, deploymentStatus]);

  const supply = useCallback(async (asset: string, amount: number, chain: string = 'ethereum') => {
    if (!user || !wallet.isConnected) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please connect your wallet to supply assets"
      });
      return;
    }

    try {
      setLoading(true);
      
      // Mock supply operation for demo
      toast({
        title: "Supply Successful",
        description: `Successfully supplied ${amount} ${asset}`
      });

      // Add to user supplies
      const newSupply: UserSupply = {
        id: `supply-${chain}-${asset}-${Date.now()}`,
        user_id: user.id,
        asset: asset as Token,
        chain: chain as Chain,
        supplied_amount_dec: amount,
        accrued_interest_dec: 0,
        used_as_collateral: true,
        created_at: new Date().toISOString()
      };

      setUserSupplies(prev => [...prev, newSupply]);
      await fetchUserData();
      await fetchPoolReserves();
    } catch (error) {
      console.error('Error supplying asset:', error);
      toast({
        variant: "destructive",
        title: "Supply Failed",
        description: error instanceof Error ? error.message : "Failed to supply asset"
      });
    } finally {
      setLoading(false);
    }
  }, [user, wallet.isConnected, toast, fetchUserData, fetchPoolReserves]);

  const withdraw = useCallback(async (asset: string, amount: number, chain: string = 'ethereum') => {
    if (!user || !wallet.isConnected) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please connect your wallet to withdraw assets"
      });
      return;
    }

    try {
      setLoading(true);
      
      // Mock withdraw operation for demo
      toast({
        title: "Withdrawal Successful",
        description: `Successfully withdrew ${amount} ${asset}`
      });

      await fetchUserData();
      await fetchPoolReserves();
    } catch (error) {
      console.error('Error withdrawing asset:', error);
      toast({
        variant: "destructive",
        title: "Withdrawal Failed",
        description: error instanceof Error ? error.message : "Failed to withdraw asset"
      });
    } finally {
      setLoading(false);
    }
  }, [user, wallet.isConnected, toast, fetchUserData, fetchPoolReserves]);

  const borrow = useCallback(async (asset: string, amount: number, rateMode: 'variable' | 'stable', chain: string = 'ethereum') => {
    if (!user || !wallet.isConnected) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please connect your wallet to borrow assets"
      });
      return;
    }

    try {
      setLoading(true);
      
      // Mock borrow operation for demo
      toast({
        title: "Borrow Successful",
        description: `Successfully borrowed ${amount} ${asset} at ${rateMode} rate`
      });

      await fetchUserData();
      await fetchPoolReserves();
    } catch (error) {
      console.error('Error borrowing asset:', error);
      toast({
        variant: "destructive",
        title: "Borrow Failed",
        description: error instanceof Error ? error.message : "Failed to borrow asset"
      });
    } finally {
      setLoading(false);
    }
  }, [user, wallet.isConnected, toast, fetchUserData, fetchPoolReserves]);

  const repay = useCallback(async (asset: string, amount: number, rateMode: 'variable' | 'stable', chain: string = 'ethereum') => {
    if (!user || !wallet.isConnected) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please connect your wallet to repay assets"
      });
      return;
    }

    try {
      setLoading(true);
      
      // Mock repay operation for demo
      toast({
        title: "Repay Successful",
        description: `Successfully repaid ${amount} ${asset}`
      });

      await fetchUserData();
      await fetchPoolReserves();
    } catch (error) {
      console.error('Error repaying asset:', error);
      toast({
        variant: "destructive",
        title: "Repay Failed",
        description: error instanceof Error ? error.message : "Failed to repay asset"
      });
    } finally {
      setLoading(false);
    }
  }, [user, wallet.isConnected, toast, fetchUserData, fetchPoolReserves]);

  const setCollateral = useCallback(async (asset: string, useAsCollateral: boolean, chain: string = 'ethereum') => {
    if (!user || !wallet.isConnected) return;

    try {
      // Update the local state for demo
      const updatedSupplies = userSupplies.map(supply => 
        supply.asset === asset && supply.chain === chain
          ? { ...supply, used_as_collateral: useAsCollateral }
          : supply
      );
      setUserSupplies(updatedSupplies);
      
      toast({
        title: "Collateral Updated",
        description: `${asset} ${useAsCollateral ? 'enabled' : 'disabled'} as collateral`
      });

      await fetchUserData();
    } catch (error) {
      console.error('Error updating collateral:', error);
      toast({
        variant: "destructive",
        title: "Collateral Update Failed",
        description: "Failed to update collateral setting"
      });
    }
  }, [user, wallet.isConnected, toast, fetchUserData, userSupplies]);

  const getAssetSupplyRate = useCallback((asset: string, chain: string = 'ethereum') => {
    const reserve = poolReserves.find(r => r.asset === asset && r.chain === chain);
    return reserve?.supply_rate || 0;
  }, [poolReserves]);

  const getAssetBorrowRate = useCallback((asset: string, rateMode: 'variable' | 'stable', chain: string = 'ethereum') => {
    const reserve = poolReserves.find(r => r.asset === asset && r.chain === chain);
    return rateMode === 'variable' ? 
      (reserve?.borrow_rate_variable || 0) : 
      (reserve?.borrow_rate_stable || 0);
  }, [poolReserves]);

  const getAvailableBorrowAmount = useCallback((asset: string, chain: string = 'ethereum') => {
    if (!userHealthFactor) return 0;
    
    const reserve = poolReserves.find(r => r.asset === asset && r.chain === chain);
    if (!reserve || !reserve.borrowing_enabled) return 0;

    return Math.min(
      userHealthFactor.available_borrow_usd,
      reserve.available_liquidity_dec
    );
  }, [userHealthFactor, poolReserves]);

  const getUserSupplyBalance = useCallback((asset: string, chain: string = 'ethereum') => {
    const supply = userSupplies.find(s => s.asset === asset && s.chain === chain);
    return supply?.supplied_amount_dec || 0;
  }, [userSupplies]);

  const getUserBorrowBalance = useCallback((asset: string, rateMode: 'variable' | 'stable', chain: string = 'ethereum') => {
    const borrow = userBorrows.find(b => b.asset === asset && b.chain === chain && b.rate_mode === rateMode);
    return borrow?.borrowed_amount_dec || 0;
  }, [userBorrows]);

  // Initialize data
  useEffect(() => {
    fetchPoolReserves();
  }, [fetchPoolReserves]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  return {
    // Data
    poolReserves,
    userSupplies,
    userBorrows,
    userHealthFactor,
    loading,
    
    // Actions
    supply,
    withdraw,
    borrow,
    repay,
    setCollateral,
    
    // Utilities
    getAssetSupplyRate,
    getAssetBorrowRate,
    getAvailableBorrowAmount,
    getUserSupplyBalance,
    getUserBorrowBalance,
    
    // Refresh
    refetch: fetchUserData,
    refetchPools: fetchPoolReserves
  };
}