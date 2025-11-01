/**
 * 01 Protocol Market Data Service
 * Fetches market data, orderbook, trades, and funding rates
 */

import { ZoClient } from './client';
import { Market, Orderbook, Trade, Candle, OrderbookLevel } from '../shared/types';

const API_BASE = 'https://api.01.xyz/v1';

export class ZoMarketService {
  private client: ZoClient;

  constructor(client: ZoClient) {
    this.client = client;
  }

  /**
   * Get all available markets
   */
  async getMarkets(): Promise<Market[]> {
    try {
      const response = await fetch(`${API_BASE}/markets`);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      
      return data.markets.map((m: any) => this.normalizeMarket(m));
    } catch (err) {
      console.error('[01Protocol] Failed to fetch markets:', err);
      throw new Error('Failed to fetch markets');
    }
  }

  /**
   * Get single market data
   */
  async getMarket(symbol: string): Promise<Market> {
    try {
      const response = await fetch(`${API_BASE}/markets/${symbol}`);
      
      if (!response.ok) {
        throw new Error(`Market ${symbol} not found`);
      }

      const data = await response.json();
      return this.normalizeMarket(data);
    } catch (err) {
      console.error('[01Protocol] Failed to fetch market:', err);
      throw new Error(`Failed to fetch market ${symbol}`);
    }
  }

  /**
   * Get orderbook for a market
   */
  async getOrderbook(symbol: string, depth: number = 20): Promise<Orderbook> {
    try {
      const response = await fetch(`${API_BASE}/orderbook/${symbol}?depth=${depth}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch orderbook for ${symbol}`);
      }

      const data = await response.json();
      
      return {
        market: symbol,
        bids: data.bids.map((b: any) => ({
          price: parseFloat(b[0]),
          size: parseFloat(b[1]),
        })),
        asks: data.asks.map((a: any) => ({
          price: parseFloat(a[0]),
          size: parseFloat(a[1]),
        })),
        timestamp: Date.now(),
      };
    } catch (err) {
      console.error('[01Protocol] Failed to fetch orderbook:', err);
      throw new Error(`Failed to fetch orderbook for ${symbol}`);
    }
  }

  /**
   * Get recent trades
   */
  async getTrades(symbol: string, limit: number = 50): Promise<Trade[]> {
    try {
      const response = await fetch(`${API_BASE}/trades/${symbol}?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch trades for ${symbol}`);
      }

      const data = await response.json();
      
      return data.trades.map((t: any) => ({
        id: t.id,
        market: symbol,
        price: parseFloat(t.price),
        size: parseFloat(t.size),
        side: t.side,
        timestamp: t.timestamp,
      }));
    } catch (err) {
      console.error('[01Protocol] Failed to fetch trades:', err);
      return [];
    }
  }

  /**
   * Get funding rate for perpetual markets
   */
  async getFundingRate(symbol: string): Promise<{
    rate: number;
    nextFundingTime: number;
  }> {
    try {
      const response = await fetch(`${API_BASE}/funding-rates/${symbol}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch funding rate for ${symbol}`);
      }

      const data = await response.json();
      
      return {
        rate: parseFloat(data.fundingRate),
        nextFundingTime: data.nextFundingTime,
      };
    } catch (err) {
      console.error('[01Protocol] Failed to fetch funding rate:', err);
      return { rate: 0, nextFundingTime: Date.now() + 8 * 60 * 60 * 1000 };
    }
  }

  /**
   * Normalize market data to common format
   */
  private normalizeMarket(data: any): Market {
    return {
      symbol: data.symbol,
      baseAsset: data.baseAsset || data.symbol.split('-')[0],
      quoteAsset: data.quoteAsset || 'USDC',
      type: 'perp',
      tickSize: parseFloat(data.tickSize) || 0.01,
      stepSize: parseFloat(data.stepSize) || 0.001,
      minOrderSize: parseFloat(data.minOrderSize) || 0.001,
      maxOrderSize: parseFloat(data.maxOrderSize) || 1000000,
      minNotional: parseFloat(data.minNotional) || 10,
      maxLeverage: parseInt(data.maxLeverage) || 10,
      fundingRate: data.fundingRate ? parseFloat(data.fundingRate) : undefined,
      nextFundingTime: data.nextFundingTime,
      markPrice: parseFloat(data.markPrice) || parseFloat(data.price) || 0,
      indexPrice: parseFloat(data.indexPrice) || parseFloat(data.price) || 0,
      volume24h: parseFloat(data.volume24h) || 0,
      high24h: parseFloat(data.high24h) || 0,
      low24h: parseFloat(data.low24h) || 0,
      change24h: parseFloat(data.change24h) || 0,
    };
  }
}
