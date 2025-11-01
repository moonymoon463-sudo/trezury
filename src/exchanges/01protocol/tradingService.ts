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
      const { data, error } = await supabase.functions.invoke('01-market-data', {
        body: { action: 'getMarkets' }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      
      return data.data;
    } catch (error) {
      console.error('Error fetching markets:', error);
      return [];
    }
  }

  /**
   * Get orderbook for a market
   */
  async getOrderbook(symbol: string, depth: number = 20): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('01-market-data', {
        body: { action: 'getOrderbook', symbol, depth }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      
      return data.data;
    } catch (error) {
      console.error('Error fetching orderbook:', error);
      return null;
    }
  }

  /**
   * Get recent trades for a market
   */
  async getTrades(symbol: string, limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase.functions.invoke('01-market-data', {
        body: { action: 'getTrades', symbol, limit }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      
      return data.data;
    } catch (error) {
      console.error('Error fetching trades:', error);
      return [];
    }
  }

  /**
   * Get funding rate for a market
   */
  async getFundingRate(symbol: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('01-market-data', {
        body: { action: 'getFundingRate', symbol }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      
      return data.data;
    } catch (error) {
      console.error('Error fetching funding rate:', error);
      return null;
    }
  }

  /**
   * Get candles/OHLCV data for a market
   */
  async getCandles(symbol: string, interval: string = '1h', limit: number = 100): Promise<any[]> {
    try {
      const { data, error } = await supabase.functions.invoke('01-market-data', {
        body: { action: 'getCandles', symbol, interval, limit }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);
      
      return data.data;
    } catch (error) {
      console.error('Error fetching candles:', error);
      return [];
    }
  }
}

// Export singleton instance
export const zoTradingService = new ZoTradingService();
