import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

/**
 * Intelligent caching for Hyperliquid data with database fallback
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

// Cache TTLs based on data type
const CACHE_TTLS = {
  candles_1m: 60_000,      // 1 minute
  candles_5m: 300_000,     // 5 minutes
  candles_15m: 900_000,    // 15 minutes
  candles_1h: 3_600_000,   // 1 hour
  candles_4h: 3_600_000,   // 1 hour
  candles_1d: 3_600_000,   // 1 hour
  orderbook: 1000,         // 1 second
  trades: 5000,            // 5 seconds
  markets: 60_000,         // 1 minute
  default: 5000            // 5 seconds
};

class HyperliquidCache {
  private memoryCache = new Map<string, CacheEntry>();
  
  /**
   * Get cached data if available and not expired
   */
  get(key: string): any | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Set data in cache with appropriate TTL
   */
  set(key: string, data: any, operation: string, interval?: string): void {
    let ttl = CACHE_TTLS.default;
    
    if (operation === 'get_candles' && interval) {
      ttl = CACHE_TTLS[`candles_${interval}` as keyof typeof CACHE_TTLS] || CACHE_TTLS.default;
    } else {
      ttl = CACHE_TTLS[operation as keyof typeof CACHE_TTLS] || CACHE_TTLS.default;
    }
    
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  /**
   * Get cached candles from database
   */
  async getCandlesFromDB(
    supabase: SupabaseClient,
    market: string,
    interval: string,
    startTime: number,
    endTime: number
  ): Promise<any[] | null> {
    try {
      const { data, error } = await supabase
        .from('hyperliquid_historical_candles')
        .select('*')
        .eq('market', market)
        .eq('interval', interval)
        .gte('timestamp', startTime)
        .lte('timestamp', endTime)
        .order('timestamp', { ascending: true });
      
      if (error) {
        console.error('[Cache] Database error:', error);
        return null;
      }
      
      if (!data || data.length === 0) {
        return null;
      }
      
      // Transform to candle format
      const intervalMs = this.getIntervalMs(interval);
      return data.map(dc => ({
        t: dc.timestamp,
        T: dc.timestamp + intervalMs,
        s: dc.market,
        i: dc.interval,
        o: dc.open,
        c: dc.close,
        h: dc.high,
        l: dc.low,
        v: dc.volume,
        n: 0
      }));
    } catch (error) {
      console.error('[Cache] Failed to get candles from DB:', error);
      return null;
    }
  }
  
  /**
   * Get interval in milliseconds
   */
  private getIntervalMs(interval: string): number {
    const map: Record<string, number> = {
      '1m': 60_000,
      '5m': 300_000,
      '15m': 900_000,
      '1h': 3_600_000,
      '4h': 14_400_000,
      '1d': 86_400_000
    };
    return map[interval] || 60_000;
  }
  
  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
      }
    }
  }
  
  /**
   * Get cache metrics
   */
  getMetrics() {
    return {
      size: this.memoryCache.size,
      entries: Array.from(this.memoryCache.keys())
    };
  }
}

export const hyperliquidCache = new HyperliquidCache();
