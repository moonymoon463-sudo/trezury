/**
 * High-performance caching service for 10k+ users
 * Provides in-memory caching with TTL and smart invalidation
 */

interface CacheItem {
  data: any;
  timestamp: number;
  ttl: number;
  expiresAt: number;
  size: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  memoryUsage: number;
}

class CachingService {
  private cache = new Map<string, CacheItem>();
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, size: 0, memoryUsage: 0 };
  private maxSize = 500; // Reduced for memory efficiency (10k+ users)
  private maxMemoryMB = 50; // Maximum 50MB for cache
  private cleanupInterval: number | null = null;
  private readonly ITEM_OVERHEAD_BYTES = 200; // Estimated overhead per item
  private inflightRequests: Map<string, Promise<any>> = new Map();
  private readonly PERSISTENT_KEYS = ['gold-prices-latest', 'user-portfolio'];

  constructor() {
    this.loadFromLocalStorage();
    this.startCleanupTimer();
  }

  /**
   * Get cached data or execute fetcher function with request deduplication
   */
  async get<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttlMs: number = 300000 // 5 minutes default
  ): Promise<T> {
    // Check in-flight request first
    if (this.inflightRequests.has(key)) {
      return this.inflightRequests.get(key) as Promise<T>;
    }

    const cached = this.cache.get(key);
    
    if (cached && Date.now() < cached.expiresAt) {
      this.stats.hits++;
      
      // Background refresh if nearing expiration (last 20% of TTL)
      const timeToExpire = cached.expiresAt - Date.now();
      if (timeToExpire < ttlMs * 0.2) {
        this.backgroundRefresh(key, fetcher, ttlMs);
      }
      
      return cached.data;
    }

    // Cache miss - fetch new data
    this.stats.misses++;
    
    // Create and store the in-flight promise
    const fetchPromise = (async () => {
      try {
        const data = await fetcher();
        this.set(key, data, ttlMs);
        return data;
      } catch (error) {
        // Return stale data if available as fallback
        if (cached) {
          return cached.data as T;
        }
        
        throw error;
      } finally {
        this.inflightRequests.delete(key);
      }
    })();
    
    this.inflightRequests.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Background refresh cache before expiration
   */
  private async backgroundRefresh<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<void> {
    try {
      const data = await fetcher();
      this.set(key, data, ttlMs);
    } catch (error) {
      // Silent failure for background refresh
    }
  }

  /**
   * Set cache item with TTL and localStorage persistence
   */
  set<T>(key: string, data: T, ttlMs: number = 300000): void {
    const expiresAt = Date.now() + ttlMs;
    const estimatedSize = this.estimateItemSize(data);
    
    // Evict oldest items if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
      expiresAt,
      size: estimatedSize
    });
    
    this.stats.size = this.cache.size;
    this.stats.memoryUsage += estimatedSize;
    
    // Persist to localStorage for selected keys
    if (this.PERSISTENT_KEYS.some(persistKey => key.includes(persistKey))) {
      this.saveToLocalStorage(key, data, expiresAt);
    }
  }

  /**
   * Save cache item to localStorage
   */
  private saveToLocalStorage(key: string, data: any, expiresAt: number): void {
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify({ data, expiresAt }));
    } catch (error) {
      console.warn(`[Cache] localStorage save failed for ${key}:`, error);
    }
  }

  /**
   * Load persistent cache from localStorage on startup
   */
  private loadFromLocalStorage(): void {
    this.PERSISTENT_KEYS.forEach(baseKey => {
      try {
        const stored = localStorage.getItem(`cache_${baseKey}`);
        if (stored) {
          const { data, expiresAt } = JSON.parse(stored);
          if (Date.now() < expiresAt) {
            const ttl = expiresAt - Date.now();
            this.set(baseKey, data, ttl);
          } else {
            localStorage.removeItem(`cache_${baseKey}`);
          }
        }
      } catch (error) {
        console.warn(`[Cache] localStorage load failed for ${baseKey}:`, error);
      }
    });
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
    }, 120000); // 2 minutes TTL for gold prices
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