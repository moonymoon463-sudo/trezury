import { supabase } from "@/integrations/supabase/client";

export interface LiquidationAuction {
  id: string;
  targetUserId: string;
  collateralAsset: string;
  debtAsset: string;
  collateralAmount: number;
  debtAmount: number;
  startTime: string;
  endTime: string;
  currentBid?: {
    bidder: string;
    amount: number;
    timestamp: string;
  };
  status: 'active' | 'completed' | 'cancelled';
}

export interface LiquidationBid {
  auctionId: string;
  bidAmount: number;
  bidder: string;
}

export class AdvancedLiquidationService {
  
  static async getActiveLiquidationAuctions(): Promise<LiquidationAuction[]> {
    try {
      const response = await supabase.functions.invoke('liquidation-auctions', {
        body: { action: 'get_active_auctions' }
      });

      if (response.error) {
        throw new Error(`Failed to get auctions: ${response.error.message}`);
      }

      return response.data?.auctions || [];
    } catch (error) {
      console.error('Error getting liquidation auctions:', error);
      throw error;
    }
  }

  static async placeLiquidationBid(bid: LiquidationBid): Promise<any> {
    try {
      const response = await supabase.functions.invoke('liquidation-auctions', {
        body: { 
          action: 'place_bid',
          ...bid
        }
      });

      if (response.error) {
        throw new Error(`Failed to place bid: ${response.error.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error placing liquidation bid:', error);
      throw error;
    }
  }

  static async createLiquidationAuction(
    targetUserId: string,
    collateralAsset: string,
    debtAsset: string,
    chain: string = 'ethereum'
  ): Promise<any> {
    try {
      const response = await supabase.functions.invoke('liquidation-auctions', {
        body: { 
          action: 'create_auction',
          target_user_id: targetUserId,
          collateral_asset: collateralAsset,
          debt_asset: debtAsset,
          chain
        }
      });

      if (response.error) {
        throw new Error(`Failed to create auction: ${response.error.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error creating liquidation auction:', error);
      throw error;
    }
  }

  static async sendLiquidationWarning(userId: string): Promise<void> {
    try {
      const response = await supabase.functions.invoke('liquidation-notifications', {
        body: { 
          action: 'send_warning',
          user_id: userId
        }
      });

      if (response.error) {
        throw new Error(`Failed to send warning: ${response.error.message}`);
      }
    } catch (error) {
      console.error('Error sending liquidation warning:', error);
      throw error;
    }
  }

  static async getLiquidationGracePeriod(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('user_health_factors')
        .select('health_factor, last_calculated_at')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      // Calculate grace period based on health factor (lower = less time)
      const healthFactor = data.health_factor;
      if (healthFactor >= 1.05) return 24; // 24 hours
      if (healthFactor >= 1.02) return 12; // 12 hours
      if (healthFactor >= 1.01) return 6;  // 6 hours
      return 2; // 2 hours for critical positions
    } catch (error) {
      console.error('Error getting liquidation grace period:', error);
      return 2; // Default to shortest grace period on error
    }
  }

  static calculateLiquidationBonus(healthFactor: number, asset: string): number {
    // Base liquidation bonus of 5%
    let bonus = 0.05;
    
    // Increase bonus for lower health factors
    if (healthFactor < 0.95) bonus = 0.08;
    if (healthFactor < 0.90) bonus = 0.10;
    if (healthFactor < 0.85) bonus = 0.12;
    
    // Asset-specific adjustments
    const assetMultipliers: Record<string, number> = {
      'XAUT': 1.0,   // Standard for gold
      'USDC': 0.8,   // Lower bonus for stablecoins
      'AURU': 1.2,   // Higher bonus for governance token
    };
    
    return bonus * (assetMultipliers[asset] || 1.0);
  }

  static formatLiquidationData(amount: number, asset: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount) + ` ${asset}`;
  }
}