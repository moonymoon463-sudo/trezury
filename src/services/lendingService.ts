import { supabase } from "@/integrations/supabase/client";
import { Chain, Token, Lock, PoolStats, LockTerm, LOCK_TERMS } from "@/types/lending";

export class LendingService {
  static async getPoolStats(chain?: Chain, token?: Token): Promise<PoolStats[]> {
    let query = supabase.from('pool_stats').select('*');
    
    if (chain) query = query.eq('chain', chain);
    if (token) query = query.eq('token', token);
    
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as PoolStats[];
  }

  static async getUserLocks(userId: string): Promise<Lock[]> {
    const { data, error } = await supabase
      .from('locks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as Lock[];
  }

  static async calculateAPY(chain: Chain, token: Token, termDays: number): Promise<number> {
    // Get pool utilization
    const poolStats = await this.getPoolStats(chain, token);
    const pool = poolStats[0];
    
    if (!pool) {
      // Default to low utilization if no pool data
      const term = LOCK_TERMS.find(t => t.days === termDays);
      return term ? term.apyMin : 0;
    }

    // Find the term configuration
    const term = LOCK_TERMS.find(t => t.days === termDays);
    if (!term) throw new Error('Invalid lock term');

    // Calculate APY based on utilization
    // utilization = totalBorrowed / totalDeposits
    const utilization = pool.total_deposits_dec > 0 
      ? pool.total_borrowed_dec / pool.total_deposits_dec 
      : 0;

    // Map utilization to APY within the band
    const apy = term.apyMin + Math.min(utilization, 1) * (term.apyMax - term.apyMin);
    
    return Math.round(apy * 100) / 100; // Round to 2 decimal places
  }

  static async createLock(
    chain: Chain,
    token: Token,
    amount: number,
    termDays: number,
    autocompound: boolean = false
  ): Promise<Lock> {
    const term = LOCK_TERMS.find(t => t.days === termDays);
    if (!term) throw new Error('Invalid lock term');

    const apyApplied = await this.calculateAPY(chain, token, termDays);
    
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + termDays * 24 * 60 * 60 * 1000);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('locks')
      .insert({
        user_id: user.id,
        chain,
        token,
        amount_dec: amount,
        apy_min: term.apyMin,
        apy_max: term.apyMax,
        apy_applied: apyApplied,
        start_ts: startDate.toISOString(),
        end_ts: endDate.toISOString(),
        autocompound
      })
      .select()
      .single();

    if (error) throw error;
    
    // Update pool stats
    await this.updatePoolStats(chain, token, amount, 0);
    
    return data as Lock;
  }

  static async exitEarly(lockId: string): Promise<void> {
    const { error } = await supabase
      .from('locks')
      .update({
        status: 'exited_early',
        accrued_interest_dec: 0
      })
      .eq('id', lockId);

    if (error) throw error;
  }

  static async claimLock(lockId: string): Promise<void> {
    const { data: lock, error: fetchError } = await supabase
      .from('locks')
      .select('*')
      .eq('id', lockId)
      .single();

    if (fetchError) throw fetchError;
    if (!lock) throw new Error('Lock not found');

    const now = new Date();
    const endDate = new Date(lock.end_ts);
    
    if (now < endDate) {
      throw new Error('Lock has not matured yet');
    }

    // Calculate final interest
    const daysLocked = Math.floor((endDate.getTime() - new Date(lock.start_ts).getTime()) / (24 * 60 * 60 * 1000));
    const dailyRate = lock.apy_applied / 365 / 100;
    const totalInterest = lock.amount_dec * dailyRate * daysLocked;

    // Update lock status
    const { error: updateError } = await supabase
      .from('locks')
      .update({
        status: 'matured',
        accrued_interest_dec: totalInterest
      })
      .eq('id', lockId);

    if (updateError) throw updateError;

    // Create payout record
    const { error: payoutError } = await supabase
      .from('payouts')
      .insert({
        lock_id: lockId,
        principal_dec: lock.amount_dec,
        interest_dec: totalInterest,
        chain: lock.chain,
        token: lock.token
      });

    if (payoutError) throw payoutError;
  }

  private static async updatePoolStats(
    chain: Chain, 
    token: Token, 
    depositChange: number, 
    borrowChange: number
  ): Promise<void> {
    const { data: currentStats } = await supabase
      .from('pool_stats')
      .select('*')
      .eq('chain', chain)
      .eq('token', token)
      .single();

    if (currentStats) {
      const newDeposits = Math.max(0, currentStats.total_deposits_dec + depositChange);
      const newBorrowed = Math.max(0, currentStats.total_borrowed_dec + borrowChange);
      const newUtilization = newDeposits > 0 ? newBorrowed / newDeposits : 0;

      await supabase
        .from('pool_stats')
        .update({
          total_deposits_dec: newDeposits,
          total_borrowed_dec: newBorrowed,
          utilization_fp: newUtilization,
          updated_ts: new Date().toISOString()
        })
        .eq('chain', chain)
        .eq('token', token);
    }
  }

  static getMaturityDate(startDate: Date, termDays: number): Date {
    return new Date(startDate.getTime() + termDays * 24 * 60 * 60 * 1000);
  }

  static formatAPY(apy: number): string {
    return `${apy.toFixed(2)}%`;
  }

  static formatAmount(amount: number, token: Token): string {
    return `${amount.toLocaleString()} ${token}`;
  }
}