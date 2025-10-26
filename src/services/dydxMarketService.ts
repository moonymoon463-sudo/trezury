import { supabase } from "@/integrations/supabase/client";
import type { DydxMarket, DydxOrderbook, DydxCandle, DydxTrade, DydxPosition, DydxRequest } from "@/types/dydx";

class DydxMarketService {
  private subscribers: Set<(markets: DydxMarket[]) => void> = new Set();
  private markets: DydxMarket[] = [];
  private updateInterval: number | null = null;
  private cache = new Map<string, { data: any; expires: number }>();

  private async callEdgeFunction<T>(request: DydxRequest): Promise<T> {
    const cacheKey = `${request.operation}_${JSON.stringify(request.params || {})}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase.functions.invoke('dydx-market-data', {
      body: request,
    });

    if (error) throw error;
    
    // Cache for 5 seconds
    this.setCache(cacheKey, data, 5);
    return data;
  }

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

  async getMarkets(): Promise<DydxMarket[]> {
    const response = await this.callEdgeFunction<{ markets: DydxMarket[] }>({
      operation: 'get_markets',
    });
    return response.markets;
  }

  async getMarket(symbol: string): Promise<DydxMarket | null> {
    const markets = await this.getMarkets();
    return markets.find(m => m.symbol === symbol) || null;
  }

  async getOrderbook(symbol: string): Promise<DydxOrderbook> {
    return this.callEdgeFunction<DydxOrderbook>({
      operation: 'get_orderbook',
      params: { market: symbol },
    });
  }

  async getCandles(symbol: string, resolution: string = '1HOUR', limit: number = 100): Promise<DydxCandle[]> {
    console.log('[dydxMarketService] getCandles called', { symbol, resolution, limit });
    
    const cacheKey = `get_candles_${JSON.stringify({ symbol, resolution, limit })}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log('[dydxMarketService] Cache hit for', symbol);
      return cached;
    }
    
    console.log('[dydxMarketService] Invoking edge function for', symbol);
    
    const { data, error } = await supabase.functions.invoke('dydx-market-data', {
      body: {
        operation: 'get_candles',
        params: { market: symbol, resolution, limit },
      },
    });

    if (error) {
      console.error('[dydxMarketService] Edge function error:', error);
      throw new Error(error.message || 'Failed to fetch candles');
    }

    console.log('[dydxMarketService] Received response:', data?.candles?.length || 0, 'candles');
    
    const candles = data?.candles || [];
    this.setCache(cacheKey, candles, 5);
    
    return candles;
  }

  async getTrades(symbol: string, limit: number = 50): Promise<DydxTrade[]> {
    const response = await this.callEdgeFunction<{ trades: DydxTrade[] }>({
      operation: 'get_trades',
      params: { market: symbol, limit },
    });
    return response.trades;
  }

  async getUserPositions(address: string): Promise<DydxPosition[]> {
    const response = await this.callEdgeFunction<{ positions: DydxPosition[] }>({
      operation: 'get_positions',
      params: { address },
    });
    return response.positions;
  }

  async getFundingRate(symbol: string): Promise<{ fundingRate: number; nextFundingTime: number | null }> {
    return this.callEdgeFunction({
      operation: 'get_funding',
      params: { market: symbol },
    });
  }

  // Get market rules for validation (tick size, step size, min order size, etc.)
  async getMarketRules(symbol: string): Promise<{
    tickSize: number;
    stepSize: number;
    minOrderSize: number;
    minNotional: number;
    maxLeverage: number;
    makerFeeRate: number;
    takerFeeRate: number;
  }> {
    const cacheKey = `market_rules_${symbol}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    // First try to get from database cache
    const { data: dbCached } = await supabase
      .from('market_rules_cache')
      .select('*')
      .eq('market', symbol)
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24h cache
      .single();

    if (dbCached) {
      const rules = {
        tickSize: Number(dbCached.tick_size),
        stepSize: Number(dbCached.step_size),
        minOrderSize: Number(dbCached.min_order_size),
        minNotional: Number(dbCached.min_notional),
        maxLeverage: dbCached.max_leverage,
        makerFeeRate: Number(dbCached.maker_fee_rate),
        takerFeeRate: Number(dbCached.taker_fee_rate),
      };
      this.setCache(cacheKey, rules, 3600); // Cache in memory for 1 hour
      return rules;
    }

    // Fetch from API and cache
    const market = await this.getMarket(symbol);
    if (!market) {
      throw new Error(`Market ${symbol} not found`);
    }

    // Default rules based on asset (these should ideally come from dYdX API)
    const rules = {
      tickSize: symbol.startsWith('BTC') ? 0.1 : symbol.startsWith('ETH') ? 0.01 : 0.001,
      stepSize: symbol.startsWith('BTC') ? 0.001 : symbol.startsWith('ETH') ? 0.01 : 0.1,
      minOrderSize: symbol.startsWith('BTC') ? 0.001 : symbol.startsWith('ETH') ? 0.01 : 1,
      minNotional: 10, // $10 minimum
      maxLeverage: 20,
      makerFeeRate: 0.0002, // 0.02%
      takerFeeRate: 0.0005, // 0.05%
    };

    // Cache in database
    await supabase
      .from('market_rules_cache')
      .upsert({
        market: symbol,
        tick_size: rules.tickSize,
        step_size: rules.stepSize,
        min_order_size: rules.minOrderSize,
        min_notional: rules.minNotional,
        max_leverage: rules.maxLeverage,
        maker_fee_rate: rules.makerFeeRate,
        taker_fee_rate: rules.takerFeeRate,
        updated_at: new Date().toISOString(),
      });

    this.setCache(cacheKey, rules, 3600);
    return rules;
  }

  // Validate order size against market rules
  validateOrderSize(size: number, price: number, rules: {
    stepSize: number;
    minOrderSize: number;
    minNotional: number;
  }): { valid: boolean; error?: string } {
    if (size < rules.minOrderSize) {
      return { valid: false, error: `Min order size: ${rules.minOrderSize}` };
    }

    const remainder = size % rules.stepSize;
    if (remainder > 0.0000001) { // Account for floating point precision
      return { valid: false, error: `Size must be multiple of ${rules.stepSize}` };
    }

    const notional = size * price;
    if (notional < rules.minNotional) {
      return { valid: false, error: `Min notional: $${rules.minNotional}` };
    }

    return { valid: true };
  }

  // Real-time updates
  startRealTimeUpdates(intervalMs: number = 10000): void {
    if (this.updateInterval) return;

    const update = async () => {
      try {
        const markets = await this.getMarkets();
        this.markets = markets;
        this.notifySubscribers();
      } catch (error) {
        console.error('[DydxMarketService] Update error:', error);
      }
    };

    update(); // Initial fetch
    this.updateInterval = window.setInterval(update, intervalMs);
  }

  stopRealTimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  subscribe(callback: (markets: DydxMarket[]) => void): () => void {
    this.subscribers.add(callback);
    if (this.markets.length > 0) {
      callback(this.markets);
    }
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.markets));
  }
}

export const dydxMarketService = new DydxMarketService();
