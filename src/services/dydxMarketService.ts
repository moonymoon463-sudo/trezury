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
