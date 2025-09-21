import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PoolAsset {
  asset: string;
  chain: string;
  supplyApy: number;
  borrowApy: number;
  totalSupply: number;
  totalBorrow: number;
  available: number;
}

export interface UserPosition {
  asset: string;
  chain: string;
  suppliedAmount: number;
  borrowedAmount: number;
  supplyApy: number;
  borrowApy: number;
}

export function useLendingOperations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [poolAssets, setPoolAssets] = useState<PoolAsset[]>([]);
  const [userPositions, setUserPositions] = useState<UserPosition[]>([]);
  const [healthFactor, setHealthFactor] = useState<number>(0);

  const fetchPoolAssets = async () => {
    try {
      const { data } = await supabase
        .from('pool_reserves')
        .select('*')
        .eq('is_active', true);
      
      if (data) {
        const assets: PoolAsset[] = data.map(pool => ({
          asset: pool.asset,
          chain: pool.chain,
          supplyApy: pool.supply_rate,
          borrowApy: pool.borrow_rate_variable,
          totalSupply: pool.total_supply_dec,
          totalBorrow: pool.total_borrowed_dec,
          available: pool.available_liquidity_dec
        }));
        setPoolAssets(assets);
      }
    } catch (error) {
      console.error('Error fetching pool assets:', error);
    }
  };

  const fetchUserPositions = async () => {
    if (!user) return;
    
    try {
      const [suppliesRes, borrowsRes, healthRes] = await Promise.all([
        supabase.from('user_supplies').select('*').eq('user_id', user.id),
        supabase.from('user_borrows').select('*').eq('user_id', user.id),
        supabase.from('user_health_factors').select('*').eq('user_id', user.id).single()
      ]);

      // Combine supplies and borrows into positions
      const positions: UserPosition[] = [];
      const assetMap = new Map();

      suppliesRes.data?.forEach(supply => {
        const key = `${supply.asset}-${supply.chain}`;
        assetMap.set(key, {
          asset: supply.asset,
          chain: supply.chain,
          suppliedAmount: supply.supplied_amount_dec,
          borrowedAmount: 0,
          supplyApy: 0,
          borrowApy: 0
        });
      });

      borrowsRes.data?.forEach(borrow => {
        const key = `${borrow.asset}-${borrow.chain}`;
        const existing = assetMap.get(key) || {
          asset: borrow.asset,
          chain: borrow.chain,
          suppliedAmount: 0,
          borrowedAmount: 0,
          supplyApy: 0,
          borrowApy: 0
        };
        existing.borrowedAmount = borrow.borrowed_amount_dec;
        assetMap.set(key, existing);
      });

      setUserPositions(Array.from(assetMap.values()));
      setHealthFactor(healthRes.data?.health_factor || 0);
    } catch (error) {
      console.error('Error fetching user positions:', error);
    }
  };

  const executeOperation = async (
    action: 'supply' | 'withdraw' | 'borrow' | 'repay',
    asset: string,
    chain: string,
    amount: number
  ) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to perform lending operations"
      });
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('lending-operations', {
        body: {
          action,
          asset,
          chain,
          amount,
          user_id: user.id
        }
      });

      if (error) throw error;

      toast({
        title: "Operation Successful",
        description: `Successfully ${action}ed ${amount} ${asset}`
      });

      // Refresh data
      await Promise.all([fetchPoolAssets(), fetchUserPositions()]);

      return data;
    } catch (error) {
      console.error(`Error during ${action}:`, error);
      toast({
        variant: "destructive",
        title: "Operation Failed",
        description: error instanceof Error ? error.message : `Failed to ${action} ${asset}`
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    // Data
    poolAssets,
    userPositions,
    healthFactor,
    loading,
    
    // Actions
    supply: (asset: string, chain: string, amount: number) => 
      executeOperation('supply', asset, chain, amount),
    withdraw: (asset: string, chain: string, amount: number) => 
      executeOperation('withdraw', asset, chain, amount),
    borrow: (asset: string, chain: string, amount: number) => 
      executeOperation('borrow', asset, chain, amount),
    repay: (asset: string, chain: string, amount: number) => 
      executeOperation('repay', asset, chain, amount),
    
    // Fetch functions
    fetchPoolAssets,
    fetchUserPositions,
    refetch: () => Promise.all([fetchPoolAssets(), fetchUserPositions()])
  };
}