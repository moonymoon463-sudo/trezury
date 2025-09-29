/**
 * High-performance caching service for 10k+ users
 * Provides in-memory caching with TTL and smart invalidation
 */

interface CacheItem {
  data: any;
  timestamp: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

class CachingService {
  private cache = new Map<string, CacheItem>();
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, size: 0 };
  private maxSize = 1000; // Maximum number of cached items
  private cleanupInterval: number | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Get cached data or execute fetcher function
   */
  async get<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttlMs: number = 300000 // 5 minutes default
  ): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.stats.hits++;
      return cached.data;
    }

    // Cache miss - fetch new data
    this.stats.misses++;
    const data = await fetcher();
    
    this.set(key, data, ttlMs);
    return data;
  }

  /**
   * Set cache item with TTL
   */
  set<T>(key: string, data: T, ttlMs: number = 300000): void {
    // Evict oldest items if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
    
    this.stats.size = this.cache.size;
  }

  /**
   * Invalidate specific cache key
   */
  invalidate(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  /**
   * Invalidate cache keys matching pattern
   */
  invalidatePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * Cache frequently accessed gold prices
   */
  async getGoldPrices() {
    return this.get('gold-prices-latest', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase
        .from('gold_prices')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    }, 60000); // 1 minute TTL for gold prices
  }

  /**
   * Cache user portfolio summary
   */
  async getUserPortfolio(userId: string) {
    return this.get(`user-portfolio-${userId}`, async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: balances } = await supabase
        .from('balance_snapshots')
        .select('asset, amount')
        .eq('user_id', userId)
        .order('snapshot_at', { ascending: false });

      // Aggregate balances by asset
      const portfolio: Record<string, number> = {};
      balances?.forEach(b => {
        portfolio[b.asset] = (portfolio[b.asset] || 0) + Number(b.amount);
      });

      return portfolio;
    }, 30000); // 30 seconds TTL for user portfolios
  }

  /**
   * Cache system metrics
   */
  async getSystemMetrics() {
    return this.get('system-metrics', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.rpc('get_system_health_metrics');
      
      if (error) throw error;
      return data;
    }, 10000); // 10 seconds TTL for system metrics
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = window.setInterval(() => {
      const now = Date.now();
      
      for (const [key, item] of this.cache.entries()) {
        if (now - item.timestamp > item.ttl) {
          this.cache.delete(key);
        }
      }
      
      this.stats.size = this.cache.size;
    }, 60000); // Cleanup every minute
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

export const cachingService = new CachingService();