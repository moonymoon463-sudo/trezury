import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LendingService } from "@/services/lendingService";
import { Lock, PoolStats, Chain, Token } from "@/types/lending";
import { useToast } from "@/hooks/use-toast";

export function useLending() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [locks, setLocks] = useState<Lock[]>([]);
  const [poolStats, setPoolStats] = useState<PoolStats[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUserLocks = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userLocks = await LendingService.getUserLocks(user.id);
      setLocks(userLocks);
    } catch (error) {
      console.error('Error fetching user locks:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch your locks"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPoolStats = async () => {
    try {
      const stats = await LendingService.getPoolStats();
      setPoolStats(stats);
    } catch (error) {
      console.error('Error fetching pool stats:', error);
    }
  };

  const createLock = async (
    chain: Chain,
    token: Token,
    amount: number,
    termDays: number,
    autocompound: boolean = false
  ) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to create a lock"
      });
      return;
    }

    try {
      setLoading(true);
      const newLock = await LendingService.createLock(chain, token, amount, termDays, autocompound);
      
      toast({
        title: "Lock Created",
        description: `Successfully locked ${amount} ${token} for ${termDays} days`
      });

      await fetchUserLocks();
      await fetchPoolStats();
      
      return newLock;
    } catch (error) {
      console.error('Error creating lock:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create lock"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const exitEarly = async (lockId: string) => {
    try {
      setLoading(true);
      await LendingService.exitEarly(lockId);
      
      toast({
        title: "Early Exit",
        description: "Lock exited early. Principal returned, interest forfeited."
      });

      await fetchUserLocks();
    } catch (error) {
      console.error('Error exiting lock:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to exit lock"
      });
    } finally {
      setLoading(false);
    }
  };

  const claimLock = async (lockId: string) => {
    try {
      setLoading(true);
      await LendingService.claimLock(lockId);
      
      toast({
        title: "Lock Claimed",
        description: "Principal and interest claimed successfully"
      });

      await fetchUserLocks();
    } catch (error) {
      console.error('Error claiming lock:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to claim lock"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateAPY = async (chain: Chain, token: Token, termDays: number) => {
    try {
      return await LendingService.calculateAPY(chain, token, termDays);
    } catch (error) {
      console.error('Error calculating APY:', error);
      return 0;
    }
  };

  useEffect(() => {
    fetchUserLocks();
    fetchPoolStats();
  }, [user]);

  return {
    locks,
    poolStats,
    loading,
    createLock,
    exitEarly,
    claimLock,
    calculateAPY,
    refetch: () => {
      fetchUserLocks();
      fetchPoolStats();
    }
  };
}