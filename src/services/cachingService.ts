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
  private maxSize = 500; // Reduced for memory efficiency (10k+ users)
  private maxMemoryMB = 50; // Maximum 50MB for cache
  private cleanupInterval: number | null = null;
  private readonly ITEM_OVERHEAD_BYTES = 200; // Estimated overhead per item

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
   * Estimate memory usage of cache item
   */
  private estimateItemSize(data: any): number {
    try {
      const json = JSON.stringify(data);
      return json.length * 2 + this.ITEM_OVERHEAD_BYTES; // UTF-16 = 2 bytes per char
    } catch {
      return this.ITEM_OVERHEAD_BYTES;
    }
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsageMB(): number {
    let totalBytes = 0;
    for (const item of this.cache.values()) {
      totalBytes += this.estimateItemSize(item.data);
    }
    return totalBytes / (1024 * 1024);
  }

  /**
   * Get cache statistics including memory usage
   */
  getStats(): CacheStats & { hitRate: number; memoryUsageMB: number; memoryLimitMB: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      memoryUsageMB: this.getMemoryUsageMB(),
      memoryLimitMB: this.maxMemoryMB
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

  /**
   * Memory-aware LRU eviction for 10k+ users
   */
  private evictOldest(): void {
    const memoryUsage = this.getMemoryUsageMB();
    const needsMemoryEviction = memoryUsage > this.maxMemoryMB;
    const needsSizeEviction = this.cache.size >= this.maxSize;

    if (!needsMemoryEviction && !needsSizeEviction) return;

    // Target: 90% of max size, 80% of max memory
    const targetSize = Math.floor(this.maxSize * 0.9);
    const targetMemory = this.maxMemoryMB * 0.8;

    // Sort by age (oldest first)
    const itemsByAge = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    let evicted = 0;
    for (const [key] of itemsByAge) {
      if (this.cache.size <= targetSize && this.getMemoryUsageMB() <= targetMemory) break;
      
      this.cache.delete(key);
      this.stats.evictions++;
      evicted++;
    }

    if (evicted > 0) {
      console.log(`[Cache] Evicted ${evicted} items. Memory: ${this.getMemoryUsageMB().toFixed(2)}MB, Size: ${this.cache.size}`);
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