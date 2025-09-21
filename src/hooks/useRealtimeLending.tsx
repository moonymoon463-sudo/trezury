import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface PoolData {
  asset: string;
  chain: string;
  supply_rate: number;
  borrow_rate_variable: number;
  borrow_rate_stable: number;
  total_supply_dec: number;
  total_borrowed_dec: number;
  available_liquidity_dec: number;
  utilization_rate: number;
  last_update_timestamp: string;
}

interface UserPosition {
  id: string;
  user_id: string;
  asset: string;
  chain: string;
  supplied_amount_dec?: number;
  borrowed_amount_dec?: number;
  accrued_interest_dec: number;
  last_interest_update: string;
}

export function useRealtimeLending() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [poolData, setPoolData] = useState<PoolData[]>([]);
  const [userSupplies, setUserSupplies] = useState<UserPosition[]>([]);
  const [userBorrows, setUserBorrows] = useState<UserPosition[]>([]);
  const [healthFactor, setHealthFactor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial data fetch
  useEffect(() => {
    if (!user) return;

    const fetchInitialData = async () => {
      try {
        setLoading(true);

        // Fetch pool reserves
        const { data: pools, error: poolsError } = await supabase
          .from('pool_reserves')
          .select('*')
          .eq('is_active', true);

        if (poolsError) throw poolsError;
        setPoolData(pools || []);

        // Fetch user supplies
        const { data: supplies, error: suppliesError } = await supabase
          .from('user_supplies')
          .select('*')
          .eq('user_id', user.id);

        if (suppliesError) throw suppliesError;
        setUserSupplies(supplies || []);

        // Fetch user borrows
        const { data: borrows, error: borrowsError } = await supabase
          .from('user_borrows')
          .select('*')
          .eq('user_id', user.id);

        if (borrowsError) throw borrowsError;
        setUserBorrows(borrows || []);

        // Fetch health factor
        const { data: healthData, error: healthError } = await supabase
          .from('user_health_factors')
          .select('health_factor')
          .eq('user_id', user.id)
          .eq('chain', 'ethereum')
          .maybeSingle();

        if (!healthError && healthData) {
          setHealthFactor(healthData.health_factor);
        }

      } catch (error) {
        console.error('Error fetching initial lending data:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load lending data"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [user, toast]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;

    console.log('Setting up real-time subscriptions for lending data...');

    // Pool reserves subscription
    const poolChannel = supabase
      .channel('pool-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pool_reserves',
          filter: 'is_active=eq.true'
        },
        (payload) => {
          console.log('Pool reserves updated:', payload);
          setPoolData(prev => {
            if (payload.eventType === 'DELETE') {
              return prev.filter(pool => pool.asset !== payload.old?.asset || pool.chain !== payload.old?.chain);
            } else {
              const updatedPool = payload.new as PoolData;
              const existingIndex = prev.findIndex(
                pool => pool.asset === updatedPool.asset && pool.chain === updatedPool.chain
              );
              
              if (existingIndex >= 0) {
                const newPools = [...prev];
                newPools[existingIndex] = updatedPool;
                return newPools;
              } else {
                return [...prev, updatedPool];
              }
            }
          });
        }
      )
      .subscribe();

    // User supplies subscription
    const suppliesChannel = supabase
      .channel('user-supplies')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_supplies',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('User supplies updated:', payload);
          setUserSupplies(prev => {
            if (payload.eventType === 'DELETE') {
              return prev.filter(supply => supply.id !== payload.old?.id);
            } else {
              const updatedSupply = payload.new as UserPosition;
              const existingIndex = prev.findIndex(supply => supply.id === updatedSupply.id);
              
              if (existingIndex >= 0) {
                const newSupplies = [...prev];
                newSupplies[existingIndex] = updatedSupply;
                return newSupplies;
              } else {
                return [...prev, updatedSupply];
              }
            }
          });
        }
      )
      .subscribe();

    // User borrows subscription
    const borrowsChannel = supabase
      .channel('user-borrows')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_borrows',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('User borrows updated:', payload);
          setUserBorrows(prev => {
            if (payload.eventType === 'DELETE') {
              return prev.filter(borrow => borrow.id !== payload.old?.id);
            } else {
              const updatedBorrow = payload.new as UserPosition;
              const existingIndex = prev.findIndex(borrow => borrow.id === updatedBorrow.id);
              
              if (existingIndex >= 0) {
                const newBorrows = [...prev];
                newBorrows[existingIndex] = updatedBorrow;
                return newBorrows;
              } else {
                return [...prev, updatedBorrow];
              }
            }
          });
        }
      )
      .subscribe();

    // Health factor subscription
    const healthChannel = supabase
      .channel('user-health')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_health_factors',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Health factor updated:', payload);
        if (payload.new && typeof payload.new === 'object' && 'health_factor' in payload.new) {
          setHealthFactor(payload.new.health_factor as number);
        }
        }
      )
      .subscribe();

    // Governance rewards subscription
    const rewardsChannel = supabase
      .channel('governance-rewards')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'governance_rewards',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New governance reward:', payload);
          toast({
            title: "Governance Reward Received!",
            description: `You earned ${payload.new.amount_dec} ${payload.new.asset} tokens`,
          });
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      console.log('Cleaning up real-time subscriptions...');
      supabase.removeChannel(poolChannel);
      supabase.removeChannel(suppliesChannel);
      supabase.removeChannel(borrowsChannel);
      supabase.removeChannel(healthChannel);
      supabase.removeChannel(rewardsChannel);
    };
  }, [user, toast]);

  // Calculate real-time metrics
  const totalSuppliedUSD = userSupplies.reduce((sum, supply) => {
    return sum + (supply.supplied_amount_dec || 0);
  }, 0);

  const totalBorrowedUSD = userBorrows.reduce((sum, borrow) => {
    return sum + (borrow.borrowed_amount_dec || 0);
  }, 0);

  const netAPY = poolData.length > 0 ? poolData.reduce((sum, pool) => {
    const userSupply = userSupplies.find(s => s.asset === pool.asset && s.chain === pool.chain);
    const supplyWeight = userSupply?.supplied_amount_dec || 0;
    return sum + (pool.supply_rate * supplyWeight);
  }, 0) / Math.max(totalSuppliedUSD, 1) : 0;

  const healthStatus = healthFactor === null ? 'unknown' :
    healthFactor >= 2.0 ? 'healthy' :
    healthFactor >= 1.5 ? 'moderate' :
    healthFactor >= 1.1 ? 'risky' : 'critical';

  return {
    poolData,
    userSupplies,
    userBorrows,
    healthFactor,
    loading,
    metrics: {
      totalSuppliedUSD,
      totalBorrowedUSD,
      netAPY,
      healthStatus
    }
  };
}