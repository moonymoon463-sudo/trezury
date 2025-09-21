import { supabase } from "@/integrations/supabase/client";

export interface LiquidationTarget {
  user_id: string;
  health_factor: number;
  total_debt_usd: number;
  total_collateral_usd: number;
  chain: string;
  liquidation_bonus: number;
  max_liquidation_amount: number;
  potential_profit: number;
}

export interface LiquidationExecution {
  liquidator_id: string;
  target_user_id: string;
  collateral_asset: string;
  debt_asset: string;
  debt_to_cover: number;
  chain: string;
}

export interface RiskAlert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  metadata: any;
  acknowledged: boolean;
  created_at: string;
}

export class LiquidationService {
  
  static async scanLiquidationTargets(): Promise<LiquidationTarget[]> {
    try {
      const response = await supabase.functions.invoke('liquidation-monitor', {
        body: { action: 'scan_liquidation_targets' }
      });

      if (response.error) {
        throw new Error(`Liquidation scan failed: ${response.error.message}`);
      }

      return response.data?.targets || [];
    } catch (error) {
      console.error('Error scanning liquidation targets:', error);
      throw error;
    }
  }

  static async executeLiquidation(params: LiquidationExecution): Promise<any> {
    try {
      const response = await supabase.functions.invoke('liquidation-monitor', {
        body: { 
          action: 'execute_liquidation',
          ...params
        }
      });

      if (response.error) {
        throw new Error(`Liquidation execution failed: ${response.error.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error executing liquidation:', error);
      throw error;
    }
  }

  static async checkUserHealth(userId: string, chain: string = 'ethereum'): Promise<any> {
    try {
      const response = await supabase.functions.invoke('liquidation-monitor', {
        body: { 
          action: 'check_user_health',
          user_id: userId,
          chain
        }
      });

      if (response.error) {
        throw new Error(`Health check failed: ${response.error.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error checking user health:', error);
      throw error;
    }
  }

  static async getLiquidationHistory(userId?: string): Promise<any[]> {
    try {
      const response = await supabase.functions.invoke('liquidation-monitor', {
        body: { 
          action: 'get_liquidation_history',
          user_id: userId
        }
      });

      if (response.error) {
        throw new Error(`Failed to get liquidation history: ${response.error.message}`);
      }

      return response.data?.liquidations || [];
    } catch (error) {
      console.error('Error getting liquidation history:', error);
      throw error;
    }
  }

  static async getUserRiskAlerts(userId: string): Promise<RiskAlert[]> {
    try {
      const { data, error } = await supabase
        .from('risk_alerts')
        .select('*')
        .eq('user_id', userId)
        .eq('acknowledged', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching risk alerts:', error);
      throw error;
    }
  }

  static async acknowledgeRiskAlert(alertId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('risk_alerts')
        .update({ 
          acknowledged: true, 
          acknowledged_at: new Date().toISOString() 
        })
        .eq('id', alertId);

      if (error) throw error;
    } catch (error) {
      console.error('Error acknowledging risk alert:', error);
      throw error;
    }
  }

  static async getUserPositionLimits(userId: string, chain: string = 'ethereum'): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('position_limits')
        .select('*')
        .eq('user_id', userId)
        .eq('chain', chain);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching position limits:', error);
      throw error;
    }
  }

  static async setPositionLimit(
    userId: string, 
    asset: string, 
    maxSupplyAmount: number, 
    maxBorrowAmount: number,
    chain: string = 'ethereum',
    riskTier: string = 'standard'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('position_limits')
        .upsert({
          user_id: userId,
          asset,
          chain,
          max_supply_amount: maxSupplyAmount,
          max_borrow_amount: maxBorrowAmount,
          risk_tier: riskTier,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error setting position limit:', error);
      throw error;
    }
  }

  static async getLiquidationThresholds(chain: string = 'ethereum'): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('liquidation_thresholds')
        .select('*')
        .eq('chain', chain);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching liquidation thresholds:', error);
      throw error;
    }
  }

  static calculateLiquidationRisk(healthFactor: number): {
    riskLevel: 'safe' | 'warning' | 'danger' | 'critical';
    riskPercentage: number;
    recommendation: string;
  } {
    if (healthFactor >= 2.0) {
      return {
        riskLevel: 'safe',
        riskPercentage: 0,
        recommendation: 'Your position is safe. You can consider increasing leverage.'
      };
    } else if (healthFactor >= 1.5) {
      return {
        riskLevel: 'warning',
        riskPercentage: 25,
        recommendation: 'Low risk. Monitor your position regularly.'
      };
    } else if (healthFactor >= 1.1) {
      return {
        riskLevel: 'danger',
        riskPercentage: 75,
        recommendation: 'High risk. Consider reducing your borrowed positions.'
      };
    } else {
      return {
        riskLevel: 'critical',
        riskPercentage: 95,
        recommendation: 'Critical risk. Take immediate action to avoid liquidation.'
      };
    }
  }

  static formatHealthFactor(healthFactor: number): string {
    if (healthFactor === null || healthFactor === undefined) {
      return 'N/A';
    }
    
    if (healthFactor > 999) {
      return '∞';
    }
    
    return healthFactor.toFixed(3);
  }

  static formatLiquidationBonus(bonus: number): string {
    return `${(bonus * 100).toFixed(1)}%`;
  }

  static formatUsdAmount(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}