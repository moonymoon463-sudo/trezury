/**
 * 01 Protocol Trading Service
 * Client-side service that calls secure edge functions for trading operations
 */

import { supabase } from '@/integrations/supabase/client';

export interface PlaceOrderParams {
  market: string;
  side: 'long' | 'short';
  size: number;
  price?: number;
  orderType: 'market' | 'limit';
  leverage?: number;
}

export interface ClosePositionParams {
  market: string;
  size?: number;
}

export interface CancelOrderParams {
  orderId: string;
  market: string;
}

export interface TradeResult {
  ok: boolean;
  message: string;
  data?: any;
  error?: string;
}

class ZoTradingService {
  private cluster: 'mainnet' | 'devnet' = 'mainnet';

  setCluster(cluster: 'mainnet' | 'devnet') {
    this.cluster = cluster;
  }

  /**
   * Place an order on 01 Protocol
   */
  async placeOrder(
    params: PlaceOrderParams,
    password: string
  ): Promise<TradeResult> {
    try {
      console.log('[01Trading] Placing order:', params);

      const { data, error } = await supabase.functions.invoke('01-trade', {
        body: {
          operation: 'place_order',
          params,
          password,
          cluster: this.cluster,
        },
      });

      if (error) {
        throw error;
      }

      return data as TradeResult;
    } catch (err) {
      console.error('[01Trading] Place order failed:', err);
      return {
        ok: false,
        message: 'Failed to place order',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Close a position on 01 Protocol
   */
  async closePosition(
    params: ClosePositionParams,
    password: string
  ): Promise<TradeResult> {
    try {
      console.log('[01Trading] Closing position:', params);

      const { data, error } = await supabase.functions.invoke('01-trade', {
        body: {
          operation: 'close_position',
          params,
          password,
          cluster: this.cluster,
        },
      });

      if (error) {
        throw error;
      }

      return data as TradeResult;
    } catch (err) {
      console.error('[01Trading] Close position failed:', err);
      return {
        ok: false,
        message: 'Failed to close position',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel an order on 01 Protocol
   */
  async cancelOrder(
    params: CancelOrderParams,
    password: string
  ): Promise<TradeResult> {
    try {
      console.log('[01Trading] Canceling order:', params);

      const { data, error } = await supabase.functions.invoke('01-trade', {
        body: {
          operation: 'cancel_order',
          params,
          password,
          cluster: this.cluster,
        },
      });

      if (error) {
        throw error;
      }

      return data as TradeResult;
    } catch (err) {
      console.error('[01Trading] Cancel order failed:', err);
      return {
        ok: false,
        message: 'Failed to cancel order',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get user positions from 01 Protocol
   */
  async getPositions(password: string): Promise<TradeResult> {
    try {
      console.log('[01Trading] Fetching positions');

      const { data, error } = await supabase.functions.invoke('01-trade', {
        body: {
          operation: 'get_positions',
          params: {},
          password,
          cluster: this.cluster,
        },
      });

      if (error) {
        throw error;
      }

      return data as TradeResult;
    } catch (err) {
      console.error('[01Trading] Get positions failed:', err);
      return {
        ok: false,
        message: 'Failed to fetch positions',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get market info (doesn't require authentication)
   */
  async getMarkets(): Promise<any[]> {
    try {
      // This would call the market data service we created earlier
      const response = await fetch('https://api.01.xyz/v1/markets');
      if (!response.ok) {
        throw new Error('Failed to fetch markets');
      }
      const data = await response.json();
      return data.markets || [];
    } catch (err) {
      console.error('[01Trading] Failed to fetch markets:', err);
      return [];
    }
  }
}

// Export singleton instance
export const zoTradingService = new ZoTradingService();
