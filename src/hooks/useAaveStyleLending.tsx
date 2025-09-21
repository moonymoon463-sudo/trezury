import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  AaveStyleLendingService, 
  PoolReserve, 
  UserSupply, 
  UserBorrow, 
  UserHealthFactor 
} from "@/services/aaveStyleLendingService";
import { useToast } from "@/hooks/use-toast";

export function useAaveStyleLending() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [poolReserves, setPoolReserves] = useState<PoolReserve[]>([]);
  const [userSupplies, setUserSupplies] = useState<UserSupply[]>([]);
  const [userBorrows, setUserBorrows] = useState<UserBorrow[]>([]);
  const [userHealthFactor, setUserHealthFactor] = useState<UserHealthFactor | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPoolReserves = useCallback(async () => {
    try {
      const reserves = await AaveStyleLendingService.getPoolReserves();
      setPoolReserves(reserves);
    } catch (error) {
      console.error('Error fetching pool reserves:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch pool data"
      });
    }
  }, [toast]);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const [supplies, borrows, healthFactor] = await Promise.all([
        AaveStyleLendingService.getUserSupplies(user.id),
        AaveStyleLendingService.getUserBorrows(user.id),
        AaveStyleLendingService.getUserHealthFactor(user.id)
      ]);
      
      setUserSupplies(supplies);
      setUserBorrows(borrows);
      setUserHealthFactor(healthFactor);
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
  }, [user, toast]);

  const supply = useCallback(async (asset: string, amount: number, chain: string = 'ethereum') => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to supply assets"
      });
      return;
    }

    try {
      setLoading(true);
      await AaveStyleLendingService.supply(asset, amount, chain);
      
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
  }, [user, toast, fetchUserData, fetchPoolReserves]);

  const withdraw = useCallback(async (asset: string, amount: number, chain: string = 'ethereum') => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to withdraw assets"
      });
      return;
    }

    try {
      setLoading(true);
      await AaveStyleLendingService.withdraw(asset, amount, chain);
      
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
  }, [user, toast, fetchUserData, fetchPoolReserves]);

  const borrow = useCallback(async (asset: string, amount: number, rateMode: 'variable' | 'stable', chain: string = 'ethereum') => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to borrow assets"
      });
      return;
    }

    try {
      setLoading(true);
      await AaveStyleLendingService.borrow(asset, amount, rateMode, chain);
      
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
  }, [user, toast, fetchUserData, fetchPoolReserves]);

  const repay = useCallback(async (asset: string, amount: number, rateMode: 'variable' | 'stable', chain: string = 'ethereum') => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to repay assets"
      });
      return;
    }

    try {
      setLoading(true);
      await AaveStyleLendingService.repay(asset, amount, rateMode, chain);
      
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
  }, [user, toast, fetchUserData, fetchPoolReserves]);

  const setCollateral = useCallback(async (asset: string, useAsCollateral: boolean, chain: string = 'ethereum') => {
    if (!user) return;

    try {
      await AaveStyleLendingService.setCollateral(asset, useAsCollateral, chain);
      
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
  }, [user, toast, fetchUserData]);

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