import { supabase } from '@/integrations/supabase/client';
import type {
  HyperliquidOrderRequest,
  HyperliquidOrderResponse,
  HyperliquidAccountState
} from '@/types/hyperliquid';

class HyperliquidTradingService {
  /**
   * Place an order via edge function
   */
  async placeOrder(
    userId: string,
    address: string,
    orderRequest: HyperliquidOrderRequest
  ): Promise<HyperliquidOrderResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('hyperliquid-trading', {
        body: {
          operation: 'place_order',
          params: {
            userId,
            address,
            ...orderRequest
          }
        }
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[HyperliquidTrading] Place order error:', error);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(
    userId: string,
    address: string,
    orderId: number,
    market: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('hyperliquid-trading', {
        body: {
          operation: 'cancel_order',
          params: {
            userId,
            address,
            orderId,
            market
          }
        }
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[HyperliquidTrading] Cancel order error:', error);
      throw error;
    }
  }

  /**
   * Cancel all orders for a market
   */
  async cancelAllOrders(
    userId: string,
    address: string,
    market?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('hyperliquid-trading', {
        body: {
          operation: 'cancel_all_orders',
          params: {
            userId,
            address,
            market
          }
        }
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[HyperliquidTrading] Cancel all orders error:', error);
      throw error;
    }
  }

  /**
   * Close a position (market order in opposite direction)
   */
  async closePosition(
    userId: string,
    address: string,
    market: string,
    size: number
  ): Promise<HyperliquidOrderResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('hyperliquid-trading', {
        body: {
          operation: 'close_position',
          params: {
            userId,
            address,
            market,
            size
          }
        }
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[HyperliquidTrading] Close position error:', error);
      throw error;
    }
  }

  /**
   * Get account info from edge function
   */
  async getAccountInfo(address: string): Promise<HyperliquidAccountState> {
    try {
      const { data, error } = await supabase.functions.invoke('hyperliquid-trading', {
        body: {
          operation: 'get_account',
          params: { address }
        }
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[HyperliquidTrading] Get account error:', error);
      throw error;
    }
  }

  /**
   * Update leverage for a market
   */
  async updateLeverage(
    userId: string,
    address: string,
    market: string,
    leverage: number,
    isCross: boolean = true
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('hyperliquid-trading', {
        body: {
          operation: 'update_leverage',
          params: {
            userId,
            address,
            market,
            leverage,
            isCross
          }
        }
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[HyperliquidTrading] Update leverage error:', error);
      throw error;
    }
  }

  /**
   * Validate order parameters
   */
  validateOrder(order: HyperliquidOrderRequest): { valid: boolean; error?: string } {
    if (order.size <= 0) {
      return { valid: false, error: 'Order size must be greater than 0' };
    }

    if (order.type === 'LIMIT' && (!order.price || order.price <= 0)) {
      return { valid: false, error: 'Limit orders require a valid price' };
    }

    if (order.leverage < 1 || order.leverage > 50) {
      return { valid: false, error: 'Leverage must be between 1 and 50' };
    }

    return { valid: true };
  }

  /**
   * Calculate liquidation price
   */
  calculateLiquidationPrice(
    entryPrice: number,
    leverage: number,
    side: 'LONG' | 'SHORT'
  ): number {
    const maintenanceMarginRate = 0.025; // 2.5% maintenance margin
    
    if (side === 'LONG') {
      return entryPrice * (1 - (1 / leverage) + maintenanceMarginRate);
    } else {
      return entryPrice * (1 + (1 / leverage) - maintenanceMarginRate);
    }
  }

  /**
   * Calculate position value
   */
  calculatePositionValue(size: number, price: number): number {
    return size * price;
  }

  /**
   * Calculate unrealized PnL
   */
  calculateUnrealizedPnL(
    entryPrice: number,
    currentPrice: number,
    size: number,
    side: 'LONG' | 'SHORT'
  ): number {
    if (side === 'LONG') {
      return (currentPrice - entryPrice) * size;
    } else {
      return (entryPrice - currentPrice) * size;
    }
  }
}

export const hyperliquidTradingService = new HyperliquidTradingService();
