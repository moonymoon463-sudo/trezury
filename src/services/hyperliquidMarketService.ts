import { HYPERLIQUID_API } from '@/config/hyperliquid';
import type {
  HyperliquidMarket,
  HyperliquidOrderbook,
  HyperliquidTrade,
  HyperliquidCandle,
  HyperliquidFundingRate,
  HyperliquidAccountState
} from '@/types/hyperliquid';

class HyperliquidMarketService {
  private baseUrl = HYPERLIQUID_API.restEndpoint;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTTL = 5000; // 5 seconds

  private async request<T>(endpoint: string, body?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || { type: endpoint })
    });

    if (!response.ok) {
      throw new Error(`Hyperliquid API error: ${response.statusText}`);
    }

    return response.json();
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Get all available markets
   */
  async getMarkets(): Promise<HyperliquidMarket[]> {
    const cacheKey = 'markets';
    const cached = this.getCached<HyperliquidMarket[]>(cacheKey);
    if (cached) return cached;

    const data = await this.request<any>('meta');
    const markets = data.universe as HyperliquidMarket[];
    
    this.setCache(cacheKey, markets);
    return markets;
  }

  /**
   * Get orderbook for a specific market
   */
  async getOrderbook(market: string): Promise<HyperliquidOrderbook> {
    const data = await this.request<HyperliquidOrderbook>('l2Book', {
      type: 'l2Book',
      coin: market
    });
    
    return data;
  }

  /**
   * Get recent trades for a market
   */
  async getTrades(market: string, limit: number = 50): Promise<HyperliquidTrade[]> {
    const data = await this.request<HyperliquidTrade[]>('recentTrades', {
      type: 'recentTrades',
      coin: market
    });
    
    return data.slice(0, limit);
  }

  /**
   * Get candlestick data
   */
  async getCandles(
    market: string,
    interval: string = '1m',
    startTime?: number,
    endTime?: number
  ): Promise<HyperliquidCandle[]> {
    const data = await this.request<HyperliquidCandle[]>('candleSnapshot', {
      type: 'candleSnapshot',
      req: {
        coin: market,
        interval,
        startTime,
        endTime
      }
    });
    
    return data;
  }

  /**
   * Get user account state
   */
  async getAccountState(address: string): Promise<HyperliquidAccountState> {
    const data = await this.request<HyperliquidAccountState>('clearinghouseState', {
      type: 'clearinghouseState',
      user: address
    });
    
    return data;
  }

  /**
   * Get funding rate for a market
   */
  async getFundingRate(market: string): Promise<HyperliquidFundingRate> {
    const data = await this.request<any>('meta');
    const marketData = data.universe.find((m: any) => m.name === market);
    
    if (!marketData) {
      throw new Error(`Market ${market} not found`);
    }

    return {
      coin: market,
      fundingRate: marketData.funding || '0',
      premium: marketData.premium || '0',
      time: Date.now()
    };
  }

  /**
   * Get user open orders
   */
  async getUserOrders(address: string): Promise<any[]> {
    const data = await this.request<any>('openOrders', {
      type: 'openOrders',
      user: address
    });
    
    return data;
  }

  /**
   * Get user fills (trade history)
   */
  async getUserFills(address: string, limit: number = 100): Promise<any[]> {
    const data = await this.request<any>('userFills', {
      type: 'userFills',
      user: address
    });
    
    return data.slice(0, limit);
  }

  /**
   * Get all tickers (24h stats)
   */
  async getAllMids(): Promise<Record<string, string>> {
    const cacheKey = 'allMids';
    const cached = this.getCached<Record<string, string>>(cacheKey);
    if (cached) return cached;

    const data = await this.request<any>('allMids');
    
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get market rules for validation
   */
  async getMarketRules(market: string) {
    const markets = await this.getMarkets();
    const marketInfo = markets.find(m => m.name === market);
    
    if (!marketInfo) {
      throw new Error(`Market ${market} not found`);
    }

    return {
      szDecimals: marketInfo.szDecimals,
      maxLeverage: marketInfo.maxLeverage,
      onlyIsolated: marketInfo.onlyIsolated
    };
  }
}

export const hyperliquidMarketService = new HyperliquidMarketService();
