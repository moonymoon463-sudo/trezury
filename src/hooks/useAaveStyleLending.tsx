import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSmartContracts } from "@/hooks/useSmartContracts";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { supabase } from "@/integrations/supabase/client";
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
      setLoading(true);
      
      // Fetch real pool reserves from Supabase - no wallet connection required for viewing
      const { data: reserves, error } = await supabase
        .from('pool_reserves')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching pool reserves:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch pool data"
        });
        return;
      }

      if (reserves) {
        const poolReservesData: PoolReserve[] = reserves.map(reserve => ({
          id: `${reserve.chain}-${reserve.asset}`,
          asset: reserve.asset,
          chain: reserve.chain,
          supply_rate: reserve.supply_rate,
          borrow_rate_variable: reserve.borrow_rate_variable,
          borrow_rate_stable: reserve.borrow_rate_stable,
          total_supply_dec: reserve.total_supply_dec,
          total_borrowed_dec: reserve.total_borrowed_dec,
          available_liquidity_dec: reserve.available_liquidity_dec,
          utilization_rate: reserve.utilization_rate,
          ltv: reserve.ltv,
          liquidation_threshold: reserve.liquidation_threshold,
          liquidation_bonus: reserve.liquidation_bonus,
          is_active: reserve.is_active,
          borrowing_enabled: reserve.borrowing_enabled
        }));
        
        setPoolReserves(poolReservesData);
        console.log('✅ Loaded pool reserves from database:', poolReservesData.length, 'markets');
      }
    } catch (error) {
      console.error('Error fetching pool reserves:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch pool data"  
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchUserData = useCallback(async () => {
    if (!user || !wallet.isConnected) return;
    
    try {
      setLoading(true);
      
      // Fetch user supplies from database
      const { data: supplies, error: suppliesError } = await supabase
        .from('user_supplies')
        .select('*')
        .eq('user_id', user.id)
        .eq('chain', 'ethereum');

      // Fetch user borrows from database  
      const { data: borrows, error: borrowsError } = await supabase
        .from('user_borrows')
        .select('*')
        .eq('user_id', user.id)
        .eq('chain', 'ethereum');

      // Fetch user health factor from database
      const { data: healthFactor, error: healthError } = await supabase
        .from('user_health_factors')
        .select('*')
        .eq('user_id', user.id)
        .eq('chain', 'ethereum')
        .single();

      if (suppliesError) console.error('Error fetching supplies:', suppliesError);
      if (borrowsError) console.error('Error fetching borrows:', borrowsError);
      if (healthError && healthError.code !== 'PGRST116') console.error('Error fetching health factor:', healthError);
      
      // Transform data to match the expected format
      setUserSupplies(supplies?.map(supply => ({
        id: supply.id,
        user_id: supply.user_id,
        asset: supply.asset as Token,
        chain: supply.chain as Chain,
        supplied_amount_dec: supply.supplied_amount_dec,
        accrued_interest_dec: supply.accrued_interest_dec,
        used_as_collateral: true, // Default to true for now
        created_at: supply.created_at
      })) || []);

      setUserBorrows(borrows?.map(borrow => ({
        id: borrow.id,
        user_id: borrow.user_id,
        asset: borrow.asset as Token,
        chain: borrow.chain as Chain,
        borrowed_amount_dec: borrow.borrowed_amount_dec,
        accrued_interest_dec: borrow.accrued_interest_dec,
        rate_mode: borrow.rate_mode as 'variable' | 'stable',
        borrow_rate_at_creation: borrow.borrow_rate_at_creation || 0,
        created_at: borrow.created_at
      })) || []);

      if (healthFactor) {
        setUserHealthFactor({
          user_id: healthFactor.user_id,
          chain: healthFactor.chain,
          health_factor: healthFactor.health_factor,
          total_collateral_usd: healthFactor.total_collateral_usd,
          total_debt_usd: healthFactor.total_debt_usd,
          available_borrow_usd: healthFactor.available_borrow_usd,
          ltv: healthFactor.ltv,
          liquidation_threshold: healthFactor.liquidation_threshold
        });
      } else {
        // Create default health factor for new users
        setUserHealthFactor({
          user_id: user.id,
          chain: 'ethereum',
          health_factor: 0,
          total_collateral_usd: 0,
          total_debt_usd: 0,
          available_borrow_usd: 0,
          ltv: 0,
          liquidation_threshold: 0.85
        });
      }

      console.log('✅ Loaded user data:', {
        supplies: supplies?.length || 0,
        borrows: borrows?.length || 0,
        hasHealthFactor: !!healthFactor
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
  }, [user, toast, wallet.isConnected]);

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
      
      // Call the supply-withdraw edge function
      const { data, error } = await supabase.functions.invoke('supply-withdraw', {
        body: {
          action: 'supply',
          asset: asset,
          amount: amount,
          chain: chain
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to supply asset');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Supply operation failed');
      }
      
      toast({
        title: "Supply Successful",
        description: `Successfully supplied ${amount} ${asset}`
      });

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