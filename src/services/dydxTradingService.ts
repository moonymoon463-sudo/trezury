import { supabase } from '@/integrations/supabase/client';
import type {
  DydxAccountInfo,
  LeverageConfig,
  OrderRequest,
  DydxOrder,
  DydxPositionDB,
  MarginRequirement,
  PositionSize,
  LeverageValidation,
  OrderResponse
} from '@/types/dydx-trading';
import type { DydxPosition } from '@/types/dydx';

class DydxTradingService {
  private cache = new Map<string, { data: any; expires: number }>();

  private getCached(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  async getAccountInfo(address: string): Promise<DydxAccountInfo> {
    const cacheKey = `account:${address}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const { data, error } = await supabase.functions.invoke('dydx-trading', {
        body: {
          operation: 'get_account',
          params: { address }
        }
      });

      if (error) throw error;
      
      this.setCache(cacheKey, data, 5);
      return data;
    } catch (err) {
      console.error('[DydxTradingService] Failed to get account info:', err);
      throw err;
    }
  }

  async getAvailableMargin(address: string): Promise<number> {
    const account = await this.getAccountInfo(address);
    return account.freeCollateral;
  }

  async getMarketLeverage(market: string): Promise<LeverageConfig> {
    const cacheKey = `leverage:${market}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const { data, error } = await supabase.functions.invoke('dydx-trading', {
        body: {
          operation: 'get_leverage_config',
          params: { market }
        }
      });

      if (error) throw error;
      
      this.setCache(cacheKey, data, 30);
      return data;
    } catch (err) {
      console.error('[DydxTradingService] Failed to get leverage config:', err);
      throw err;
    }
  }

  calculateMaxPositionSize(
    balance: number,
    price: number,
    leverage: number
  ): number {
    if (leverage <= 0 || price <= 0) return 0;
    return (balance * leverage) / price;
  }

  calculatePositionSize(
    availableMargin: number,
    price: number,
    leverage: number
  ): PositionSize {
    const maxSize = this.calculateMaxPositionSize(availableMargin, price, leverage);
    // Recommend using 80% of max to leave buffer
    const recommendedSize = maxSize * 0.8;

    return {
      maxSize,
      recommendedSize,
      basedOnLeverage: leverage
    };
  }

  async placeMarketOrder(request: OrderRequest): Promise<OrderResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('dydx-trading', {
        body: {
          operation: 'place_order',
          params: {
            ...request,
            type: 'MARKET'
          }
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          errorCode: 'EXECUTION_ERROR'
        };
      }

      return {
        success: true,
        order: data.order,
        txHash: data.txHash
      };
    } catch (err) {
      console.error('[DydxTradingService] Market order failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        errorCode: 'NETWORK_ERROR'
      };
    }
  }

  async placeLimitOrder(request: OrderRequest): Promise<OrderResponse> {
    if (!request.price) {
      return {
        success: false,
        error: 'Limit orders require a price',
        errorCode: 'INVALID_PRICE'
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('dydx-trading', {
        body: {
          operation: 'place_order',
          params: {
            ...request,
            type: 'LIMIT'
          }
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          errorCode: 'EXECUTION_ERROR'
        };
      }

      return {
        success: true,
        order: data.order,
        txHash: data.txHash
      };
    } catch (err) {
      console.error('[DydxTradingService] Limit order failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        errorCode: 'NETWORK_ERROR'
      };
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('dydx-trading', {
        body: {
          operation: 'cancel_order',
          params: { orderId }
        }
      });

      return !error;
    } catch (err) {
      console.error('[DydxTradingService] Cancel order failed:', err);
      return false;
    }
  }

  async getOpenPositions(address: string): Promise<DydxPositionDB[]> {
    try {
      const { data, error } = await supabase
        .from('dydx_positions')
        .select('*')
        .eq('address', address)
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false });

      if (error) throw error;
      return (data as any[]) || [];
    } catch (err) {
      console.error('[DydxTradingService] Failed to get positions:', err);
      return [];
    }
  }

  async closePosition(market: string, size?: number): Promise<OrderResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('dydx-trading', {
        body: {
          operation: 'close_position',
          params: { market, size }
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          errorCode: 'EXECUTION_ERROR'
        };
      }

      return {
        success: true,
        order: data.order,
        txHash: data.txHash
      };
    } catch (err) {
      console.error('[DydxTradingService] Close position failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        errorCode: 'NETWORK_ERROR'
      };
    }
  }

  async getOrderHistory(address: string, limit: number = 50): Promise<DydxOrder[]> {
    const cacheKey = `orders:${address}:${limit}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const { data, error } = await supabase
        .from('dydx_orders')
        .select('*')
        .eq('address', address)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      this.setCache(cacheKey, (data as any[]) || [], 10);
      return (data as any[]) || [];
    } catch (err) {
      console.error('[DydxTradingService] Failed to get order history:', err);
      return [];
    }
  }

  validateLeverage(market: string, leverage: number): LeverageValidation {
    // Major markets support up to 20x
    const majorMarkets = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
    const maxLeverage = majorMarkets.includes(market) ? 20 : 10;

    if (leverage < 1) {
      return {
        valid: false,
        maxAllowed: maxLeverage,
        reason: 'Leverage must be at least 1x'
      };
    }

    if (leverage > maxLeverage) {
      return {
        valid: false,
        maxAllowed: maxLeverage,
        reason: `Maximum leverage for ${market} is ${maxLeverage}x`
      };
    }

    return {
      valid: true,
      maxAllowed: maxLeverage
    };
  }

  calculateLiquidationPrice(
    entryPrice: number,
    leverage: number,
    side: 'LONG' | 'SHORT',
    maintenanceMargin: number = 0.03
  ): number {
    if (side === 'LONG') {
      // For long: liquidation = entry * (1 - (1/leverage - maintenanceMargin))
      return entryPrice * (1 - (1 / leverage - maintenanceMargin));
    } else {
      // For short: liquidation = entry * (1 + (1/leverage - maintenanceMargin))
      return entryPrice * (1 + (1 / leverage - maintenanceMargin));
    }
  }

  checkMarginRequirement(
    order: OrderRequest,
    availableBalance: number,
    currentPrice: number
  ): MarginRequirement {
    const orderValue = order.size * (order.price || currentPrice);
    const requiredMargin = orderValue / order.leverage;
    const sufficient = availableBalance >= requiredMargin;

    const liquidationPrice = this.calculateLiquidationPrice(
      order.price || currentPrice,
      order.leverage,
      order.side === 'BUY' ? 'LONG' : 'SHORT'
    );

    return {
      requiredMargin,
      availableMargin: availableBalance,
      sufficient,
      liquidationPrice
    };
  }
}

export const dydxTradingService = new DydxTradingService();
