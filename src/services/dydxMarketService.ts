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

  // Get market rules for validation and leverage configuration from dYdX Indexer
  async getMarketRules(symbol: string): Promise<{
    tickSize: number;
    stepSize: number;
    minOrderSize: number;
    minNotional: number;
    maxLeverage: number;
    initialMarginFraction: number;
    maintenanceMarginFraction: number;
    makerFeeRate: number;
    takerFeeRate: number;
  }> {
    const cacheKey = `market_rules_${symbol}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      // Fetch real market configuration from dYdX Indexer API
      const response = await fetch('https://indexer.dydx.trade/v4/perpetualMarkets');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch market data: ${response.statusText}`);
      }

      const data = await response.json();
      const marketData = data.markets?.[symbol];

      if (!marketData) {
        throw new Error(`Market ${symbol} not found in dYdX Indexer`);
      }

      // Parse real market rules from dYdX
      const atomicResolution = marketData.atomicResolution || -10;
      const quantumConversionExponent = marketData.quantumConversionExponent || -9;
      
      const rules = {
        tickSize: parseFloat(marketData.tickSize) * Math.pow(10, atomicResolution),
        stepSize: parseFloat(marketData.stepBaseQuantums || 1000000) * Math.pow(10, quantumConversionExponent),
        minOrderSize: parseFloat(marketData.minOrderBaseQuantums || 1000000) * Math.pow(10, quantumConversionExponent),
        minNotional: 10, // dYdX minimum
        maxLeverage: Math.floor(1 / parseFloat(marketData.initialMarginFraction || 0.05)),
        initialMarginFraction: parseFloat(marketData.initialMarginFraction || 0.05),
        maintenanceMarginFraction: parseFloat(marketData.maintenanceMarginFraction || 0.03),
        makerFeeRate: 0.0002, // 0.02% - can be fetched from account tier
        takerFeeRate: 0.0005, // 0.05%
      };

      console.log(`[dydxMarketService] Fetched real rules for ${symbol}:`, rules);

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

      this.setCache(cacheKey, rules, 3600); // Cache for 1 hour
      return rules;

    } catch (error) {
      console.error('[dydxMarketService] Failed to fetch market rules from Indexer:', error);
      
      // Fallback to approximate rules if API fails
      const fallbackRules = {
        tickSize: symbol.startsWith('BTC') ? 0.1 : symbol.startsWith('ETH') ? 0.01 : 0.001,
        stepSize: symbol.startsWith('BTC') ? 0.001 : symbol.startsWith('ETH') ? 0.01 : 0.1,
        minOrderSize: symbol.startsWith('BTC') ? 0.001 : symbol.startsWith('ETH') ? 0.01 : 1,
        minNotional: 10,
        maxLeverage: 20,
        initialMarginFraction: 0.05, // 20x leverage = 5% initial margin
        maintenanceMarginFraction: symbol.startsWith('BTC') || symbol.startsWith('ETH') ? 0.03 : 0.05,
        makerFeeRate: 0.0002,
        takerFeeRate: 0.0005,
      };

      this.setCache(cacheKey, fallbackRules, 300); // Cache fallback for 5 min only
      return fallbackRules;
    }
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
