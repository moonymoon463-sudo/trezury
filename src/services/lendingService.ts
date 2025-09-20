import { supabase } from "@/integrations/supabase/client";
import { Chain, Token, Lock, LockTerm, LOCK_TERMS } from "@/types/lending";

export class LendingService {
  // Pool stats removed - sensitive data now backend-only

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
    // Use backend function for secure APY calculation
    try {
      const response = await supabase.functions.invoke('lending-rates', {
        body: { chain, token, termDays }
      });

      if (response.error) {
        console.error('Error calling lending-rates function:', response.error);
        // Fallback to minimum APY
        const term = LOCK_TERMS.find(t => t.days === termDays);
        return term ? term.apyMin : 0;
      }

      return response.data?.apy || 0;
    } catch (error) {
      console.error('Error calculating APY:', error);
      // Fallback to minimum APY
      const term = LOCK_TERMS.find(t => t.days === termDays);
      return term ? term.apyMin : 0;
    }
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
    
    // Pool stats updates handled by backend accrual function
    
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
    const grossInterest = lock.amount_dec * dailyRate * daysLocked;
    
    // Calculate platform fee (1.8% of earned interest)
    const platformFeeRate = lock.platform_fee_rate || 0.018; // Default to 1.8%
    const platformFee = grossInterest * platformFeeRate;
    const netInterest = grossInterest - platformFee;

    // Update lock status
    const { error: updateError } = await supabase
      .from('locks')
      .update({
        status: 'matured',
        accrued_interest_dec: netInterest
      })
      .eq('id', lockId);

    if (updateError) throw updateError;

    // Create payout record
    const { error: payoutError } = await supabase
      .from('payouts')
      .insert({
        lock_id: lockId,
        principal_dec: lock.amount_dec,
        interest_dec: netInterest,
        platform_fee_dec: platformFee,
        chain: lock.chain,
        token: lock.token
      });

    if (payoutError) throw payoutError;

    // Create fee collection request for platform fee
    if (platformFee > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: feeRequestError } = await supabase
          .from('fee_collection_requests')
          .insert({
            user_id: user.id,
            transaction_id: lockId, // Use lock ID as transaction reference
            amount: platformFee,
            asset: lock.token,
            from_address: user.id, // Will be replaced with actual wallet address
            to_address: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835',
            status: 'pending',
            metadata: {
              fee_type: 'lending_completion',
              lock_id: lockId,
              gross_interest: grossInterest,
              platform_fee_rate: platformFeeRate
            }
          });

        if (feeRequestError) {
          console.error('Failed to create fee collection request:', feeRequestError);
        }
      }
    }
  }

  // Pool stats management removed - sensitive data handled by backend only

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