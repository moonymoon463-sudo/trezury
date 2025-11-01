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
      
      // Edge function returns { success: true, account: {...} }
      const accountInfo = data.account || data;
      this.setCache(cacheKey, accountInfo, 5);
      return accountInfo;
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
      
      // Edge function returns { success: true, config: {...} }
      const config = data.config || data;
      this.setCache(cacheKey, config, 30);
      return config;
    } catch (err) {
      console.error('[DydxTradingService] Failed to get leverage config:', err);
      throw err;
    }
  }

  async calculateMaxPositionSize(
    market: string,
    availableCollateral: number,
    currentPrice: number,
    leverage: number
  ): Promise<number> {
    if (leverage <= 0 || currentPrice <= 0 || availableCollateral <= 0) return 0;

    try {
      // Get real market configuration
      const { dydxMarketService } = await import('./dydxMarketService');
      const rules = await dydxMarketService.getMarketRules(market);
      
      // CORRECT FORMULA: maxSize = freeCollateral / (price * initialMarginFraction)
      // Where initialMarginFraction = 1 / maxLeverage
      const initialMarginFraction = rules.initialMarginFraction;
      const maxSize = availableCollateral / (currentPrice * initialMarginFraction);
      
      console.log('[DydxTradingService] Max position size calculated:', {
        market,
        availableCollateral,
        currentPrice,
        leverage,
        initialMarginFraction,
        maxSize
      });

      return Number(maxSize.toFixed(8));
    } catch (error) {
      console.error('[DydxTradingService] Error calculating max position size:', error);
      // Fallback to simple calculation
      return (availableCollateral * leverage) / currentPrice;
    }
  }

  async calculatePositionSize(
    market: string,
    availableMargin: number,
    currentPrice: number,
    leverage: number
  ): Promise<PositionSize> {
    const maxSize = await this.calculateMaxPositionSize(market, availableMargin, currentPrice, leverage);
    // Recommend using 80% of max to leave buffer for price movements
    const recommendedSize = maxSize * 0.8;

    return {
      maxSize: Number(maxSize.toFixed(8)),
      recommendedSize: Number(recommendedSize.toFixed(8)),
      basedOnLeverage: leverage
    };
  }

  async placeMarketOrder(request: OrderRequest & { password: string }): Promise<OrderResponse> {
    try {
      console.log('[DydxTradingService] Placing market order:', request);
      
      const { data, error } = await supabase.functions.invoke('dydx-trading', {
        body: {
          operation: 'place_order',
          params: { ...request, type: 'MARKET', password: request.password }
        }
      });

      if (error) {
        console.error('[DydxTradingService] Edge function error:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to place order', 
          errorCode: 'EXECUTION_ERROR' 
        };
      }

      // Handle both success/failure responses from edge function
      if (data.success === false) {
        return { 
          success: false, 
          error: data.message || data.error || 'Order failed', 
          errorCode: data.error || 'ORDER_FAILED' 
        };
      }

      return { success: true, order: data.order, txHash: data.txHash };
    } catch (err) {
      console.error('[DydxTradingService] Market order failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        errorCode: 'NETWORK_ERROR'
      };
    }
  }

  async placeLimitOrder(request: OrderRequest & { password: string }): Promise<OrderResponse> {
    if (!request.price) {
      return { success: false, error: 'Limit orders require a price', errorCode: 'INVALID_PRICE' };
    }

    try {
      console.log('[DydxTradingService] Placing limit order:', request);
      
      const { data, error } = await supabase.functions.invoke('dydx-trading', {
        body: {
          operation: 'place_order',
          params: { ...request, type: 'LIMIT', password: request.password }
        }
      });

      if (error) {
        console.error('[DydxTradingService] Edge function error:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to place order', 
          errorCode: 'EXECUTION_ERROR' 
        };
      }

      // Handle both success/failure responses from edge function
      if (data.success === false) {
        return { 
          success: false, 
          error: data.message || data.error || 'Order failed', 
          errorCode: data.error || 'ORDER_FAILED' 
        };
      }

      return { success: true, order: data.order, txHash: data.txHash };
    } catch (err) {
      console.error('[DydxTradingService] Limit order failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        errorCode: 'NETWORK_ERROR'
      };
    }
  }

  async cancelOrder(orderId: string, password: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('dydx-trading', {
        body: { operation: 'cancel_order', params: { orderId, password } }
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

  async closePosition(
    market: string, 
    password: string, 
    size?: number,
    orderType: 'MARKET' | 'LIMIT' = 'MARKET',
    price?: number
  ): Promise<OrderResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('dydx-trading', {
        body: { 
          operation: 'close_position', 
          params: { market, size, password, orderType, price } 
        }
      });

      if (error) {
        return { success: false, error: error.message, errorCode: 'EXECUTION_ERROR' };
      }

      return { success: true, order: data.order, txHash: data.txHash };
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

  async calculateLiquidationPrice(
    market: string,
    entryPrice: number,
    leverage: number,
    side: 'LONG' | 'SHORT'
  ): Promise<number> {
    try {
      // Get real maintenance margin for this market
      const { dydxMarketService } = await import('./dydxMarketService');
      const rules = await dydxMarketService.getMarketRules(market);
      const maintenanceMargin = rules.maintenanceMarginFraction;

      if (side === 'LONG') {
        // For long: liquidation = entry * (1 - (1/leverage - maintenanceMargin))
        return entryPrice * (1 - (1 / leverage - maintenanceMargin));
      } else {
        // For short: liquidation = entry * (1 + (1/leverage - maintenanceMargin))
        return entryPrice * (1 + (1 / leverage - maintenanceMargin));
      }
    } catch (error) {
      console.error('[DydxTradingService] Error calculating liquidation price:', error);
      // Fallback to 3% maintenance margin
      const maintenanceMargin = 0.03;
      if (side === 'LONG') {
        return entryPrice * (1 - (1 / leverage - maintenanceMargin));
      } else {
        return entryPrice * (1 + (1 / leverage - maintenanceMargin));
      }
    }
  }

  async checkMarginRequirement(
    order: OrderRequest,
    availableBalance: number,
    currentPrice: number
  ): Promise<MarginRequirement> {
    const orderValue = order.size * (order.price || currentPrice);
    const requiredMargin = orderValue / order.leverage;
    const sufficient = availableBalance >= requiredMargin;

    const liquidationPrice = await this.calculateLiquidationPrice(
      order.market,
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
