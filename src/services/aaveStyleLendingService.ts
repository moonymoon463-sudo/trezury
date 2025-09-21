import { supabase } from "@/integrations/supabase/client";

export interface PoolReserve {
  id: string;
  asset: string;
  chain: string;
  total_supply_dec: number;
  total_borrowed_dec: number;
  available_liquidity_dec: number;
  utilization_rate: number;
  supply_rate: number;
  borrow_rate_variable: number;
  borrow_rate_stable: number;
  ltv: number;
  liquidation_threshold: number;
  liquidation_bonus: number;
  is_active: boolean;
  borrowing_enabled: boolean;
}

export interface UserSupply {
  id: string;
  user_id: string;
  asset: string;
  chain: string;
  supplied_amount_dec: number;
  accrued_interest_dec: number;
  used_as_collateral: boolean;
  created_at: string;
}

export interface UserBorrow {
  id: string;
  user_id: string;
  asset: string;
  chain: string;
  borrowed_amount_dec: number;
  accrued_interest_dec: number;
  rate_mode: 'variable' | 'stable';
  borrow_rate_at_creation: number;
  created_at: string;
}

export interface UserHealthFactor {
  user_id: string;
  chain: string;
  health_factor: number;
  total_collateral_usd: number;
  total_debt_usd: number;
  available_borrow_usd: number;
  ltv: number;
  liquidation_threshold: number;
}

export class AaveStyleLendingService {
  // Get all pool reserves
  static async getPoolReserves(): Promise<PoolReserve[]> {
    const { data, error } = await supabase
      .from('pool_reserves')
      .select('*')
      .eq('is_active', true)
      .order('asset');

    if (error) throw error;
    return data || [];
  }

  // Get specific pool reserve
  static async getPoolReserve(asset: string, chain: string = 'ethereum'): Promise<PoolReserve | null> {
    const { data, error } = await supabase
      .from('pool_reserves')
      .select('*')
      .eq('asset', asset)
      .eq('chain', chain)
      .single();

    if (error) throw error;
    return data;
  }

  // Get user supplies
  static async getUserSupplies(userId: string): Promise<UserSupply[]> {
    const { data, error } = await supabase
      .from('user_supplies')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get user borrows
  static async getUserBorrows(userId: string): Promise<UserBorrow[]> {
    const { data, error } = await supabase
      .from('user_borrows')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(borrow => ({
      ...borrow,
      rate_mode: borrow.rate_mode as 'variable' | 'stable'
    }));
  }

  // Get user health factor
  static async getUserHealthFactor(userId: string, chain: string = 'ethereum'): Promise<UserHealthFactor | null> {
    const { data, error } = await supabase
      .from('user_health_factors')
      .select('*')
      .eq('user_id', userId)
      .eq('chain', chain)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Supply asset to the pool
  static async supply(asset: string, amount: number, chain: string = 'ethereum'): Promise<void> {
    const { error } = await supabase.functions.invoke('supply-withdraw', {
      body: {
        action: 'supply',
        asset,
        amount,
        chain
      }
    });

    if (error) throw error;
  }

  // Withdraw asset from the pool
  static async withdraw(asset: string, amount: number, chain: string = 'ethereum'): Promise<void> {
    const { error } = await supabase.functions.invoke('supply-withdraw', {
      body: {
        action: 'withdraw',
        asset,
        amount,
        chain
      }
    });

    if (error) throw error;
  }

  // Borrow asset from the pool
  static async borrow(asset: string, amount: number, rateMode: 'variable' | 'stable', chain: string = 'ethereum'): Promise<void> {
    const { error } = await supabase.functions.invoke('borrow-repay', {
      body: {
        action: 'borrow',
        asset,
        amount,
        rateMode,
        chain
      }
    });

    if (error) throw error;
  }

  // Repay borrowed asset
  static async repay(asset: string, amount: number, rateMode: 'variable' | 'stable', chain: string = 'ethereum'): Promise<void> {
    const { error } = await supabase.functions.invoke('borrow-repay', {
      body: {
        action: 'repay',
        asset,
        amount,
        rateMode,
        chain
      }
    });

    if (error) throw error;
  }

  // Toggle asset as collateral
  static async setCollateral(asset: string, useAsCollateral: boolean, chain: string = 'ethereum'): Promise<void> {
    const { error } = await supabase
      .from('user_supplies')
      .update({ used_as_collateral: useAsCollateral })
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .eq('asset', asset)
      .eq('chain', chain);

    if (error) throw error;
  }

  // Calculate health factor for a user
  static async calculateHealthFactor(userId: string, chain: string = 'ethereum'): Promise<number> {
    const { data, error } = await supabase.functions.invoke('health-factor-calculator', {
      body: {
        userId,
        chain
      }
    });

    if (error) throw error;
    return data?.healthFactor || 0;
  }

  // Get available borrow amount for user
  static async getAvailableBorrowAmount(userId: string, asset: string, chain: string = 'ethereum'): Promise<number> {
    const healthFactor = await this.getUserHealthFactor(userId, chain);
    if (!healthFactor) return 0;

    const poolReserve = await this.getPoolReserve(asset, chain);
    if (!poolReserve || !poolReserve.borrowing_enabled) return 0;

    return Math.min(
      healthFactor.available_borrow_usd,
      poolReserve.available_liquidity_dec
    );
  }

  // Format APY for display
  static formatAPY(apy: number): string {
    return `${(apy * 100).toFixed(2)}%`;
  }

  // Format amount with token symbol
  static formatAmount(amount: number, asset: string): string {
    return `${amount.toLocaleString()} ${asset}`;
  }

  // Check if asset is supported
  static async isAssetSupported(asset: string, chain: string = 'ethereum'): Promise<boolean> {
    const poolReserve = await this.getPoolReserve(asset, chain);
    return poolReserve?.is_active === true;
  }

  // Get governance rewards for user
  static async getGovernanceRewards(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('governance_rewards')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Claim governance rewards
  static async claimGovernanceRewards(rewardIds: string[]): Promise<void> {
    const { error } = await supabase.functions.invoke('governance-rewards', {
      body: {
        action: 'claim',
        rewardIds
      }
    });

    if (error) throw error;
  }
}