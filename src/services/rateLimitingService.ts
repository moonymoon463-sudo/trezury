/**
 * Rate limiting service for 10k+ users
 * Implements token bucket algorithm with different tiers
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  tier: 'basic' | 'premium' | 'admin';
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per second
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  tier: string;
}

class RateLimitingService {
  private buckets = new Map<string, TokenBucket>();
  private configs: Record<string, RateLimitConfig> = {
    basic: { maxRequests: 100, windowMs: 60000, tier: 'basic' }, // 100/min
    premium: { maxRequests: 500, windowMs: 60000, tier: 'premium' }, // 500/min
    admin: { maxRequests: 1000, windowMs: 60000, tier: 'admin' }, // 1000/min
  };
  
  // Scaling limits for 10k+ users
  private readonly MAX_BUCKETS = 50000; // Support up to 50k active buckets
  private readonly CLEANUP_INTERVAL_MS = 300000; // Cleanup every 5 minutes
  private readonly BUCKET_EXPIRY_MS = 3600000; // Expire buckets after 1 hour of inactivity
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Check if request is allowed under rate limit
   */
  checkLimit(
    identifier: string, 
    tier: 'basic' | 'premium' | 'admin' = 'basic',
    cost: number = 1
  ): RateLimitResult {
    const config = this.configs[tier];
    const bucketKey = `${identifier}:${tier}`;
    
    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        tokens: config.maxRequests,
        lastRefill: Date.now(),
        maxTokens: config.maxRequests,
        refillRate: config.maxRequests / (config.windowMs / 1000) // tokens per second
      };
      this.buckets.set(bucketKey, bucket);
    }

    // Refill tokens based on time elapsed
    const now = Date.now();
    const timePassed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = Math.floor(timePassed * bucket.refillRate);
    
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if request can be allowed
    const allowed = bucket.tokens >= cost;
    if (allowed) {
      bucket.tokens -= cost;
    }

    // Calculate reset time
    const tokensNeeded = cost - bucket.tokens;
    const resetTime = tokensNeeded > 0 
      ? now + (tokensNeeded / bucket.refillRate * 1000)
      : now;

    return {
      allowed,
      remaining: Math.max(0, bucket.tokens),
      resetTime,
      tier
    };
  }

  /**
   * Get user tier based on KYC status and premium features
   */
  async getUserTier(userId: string): Promise<'basic' | 'premium' | 'admin'> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
    // Check if admin
      const { data: isAdminData } = await supabase.rpc('is_admin', { _user_id: userId });
      if (isAdminData) return 'admin';

      // Check profile for premium features (use masked view)
      const { data: profile } = await supabase
        .from('v_profiles_masked')
        .select('kyc_status')
        .eq('id', userId)
        .maybeSingle();

      // Premium tier for verified KYC users
      if (profile?.kyc_status === 'verified') {
        return 'premium';
      }

      return 'basic';
    } catch (error) {
      return 'basic';
    }
  }

  /**
   * Rate limit API requests based on endpoint
   */
  async checkApiLimit(
    userId: string, 
    endpoint: string,
    cost: number = 1
  ): Promise<RateLimitResult> {
    const tier = await this.getUserTier(userId);
    const identifier = `${userId}:${endpoint}`;
    
    return this.checkLimit(identifier, tier, cost);
  }

  /**
   * Rate limit transaction operations (higher cost)
   * ✅ PHASE 4: ENHANCED TIERED RATE LIMITING
   */
  async checkTransactionLimit(userId: string): Promise<RateLimitResult> {
    const tier = await this.getUserTier(userId);
    const identifier = `${userId}:transactions`;
    
    // ✅ STRICTER LIMITS FOR UNVERIFIED USERS
    let cost: number;
    let maxTransactions: number;
    
    if (tier === 'basic') {
      cost = 10; // Much higher cost for unverified
      maxTransactions = 10; // Max 10 transactions per hour for basic
    } else if (tier === 'premium') {
      cost = 3;
      maxTransactions = 50; // 50 transactions per hour for verified
    } else {
      cost = 1;
      maxTransactions = 1000; // Unlimited for admin
    }
    
    // Check both cost-based and absolute count
    const costResult = this.checkLimit(identifier, tier, cost);
    
    // Also check absolute transaction count
    const countResult = this.checkAbsoluteLimit(
      `${userId}:tx_count`,
      maxTransactions,
      3600000 // 1 hour window
    );
    
    return {
      allowed: costResult.allowed && countResult.allowed,
      remaining: Math.min(costResult.remaining, countResult.remaining),
      resetTime: Math.max(costResult.resetTime, countResult.resetTime),
      tier
    };
  }

  /**
   * Check absolute count limit (not token-based)
   * ✅ NEW: Enforce hard transaction count limits
   */
  private checkAbsoluteLimit(
    identifier: string,
    maxCount: number,
    windowMs: number
  ): RateLimitResult {
    const key = `count_${identifier}`;
    const now = Date.now();
    
    // Simple sliding window counter
    if (!this.buckets.has(key)) {
      this.buckets.set(key, {
        tokens: 0,
        lastRefill: now,
        maxTokens: maxCount,
        refillRate: maxCount / (windowMs / 1000)
      });
    }
    
    const bucket = this.buckets.get(key)!;
    
    // Reset if window expired
    if (now - bucket.lastRefill > windowMs) {
      bucket.tokens = 0;
      bucket.lastRefill = now;
    }
    
    bucket.tokens += 1;
    const allowed = bucket.tokens <= maxCount;
    
    return {
      allowed,
      remaining: Math.max(0, maxCount - bucket.tokens),
      resetTime: bucket.lastRefill + windowMs,
      tier: 'count_based'
    };
  }

  /**
   * Rate limit gold price requests
   */
  checkGoldPriceLimit(identifier: string): RateLimitResult {
    // More lenient for public gold price data
    return this.checkLimit(`goldprice:${identifier}`, 'premium');
  }

  /**
   * Get rate limit status for user
   */
  async getRateLimitStatus(userId: string): Promise<{
    tier: string;
    limits: Record<string, RateLimitResult>;
  }> {
    const tier = await this.getUserTier(userId);
    
    const limits = {
      api: this.checkLimit(`${userId}:api`, tier, 0), // Check without consuming
      transactions: this.checkLimit(`${userId}:transactions`, tier, 0),
      quotes: this.checkLimit(`${userId}:quotes`, tier, 0),
    };

    return { tier, limits };
  }

  /**
   * Clear rate limits for user (admin function)
   */
  clearUserLimits(userId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.buckets.keys()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.buckets.delete(key));
  }

  /**
   * Get rate limiting statistics with health metrics
   */
  getStats() {
    const memoryEstimateMB = (this.buckets.size * 200) / (1024 * 1024); // ~200 bytes per bucket
    const capacityUsage = (this.buckets.size / this.MAX_BUCKETS) * 100;
    
    const stats = {
      totalBuckets: this.buckets.size,
      maxBuckets: this.MAX_BUCKETS,
      capacityUsage: `${capacityUsage.toFixed(1)}%`,
      estimatedMemoryMB: memoryEstimateMB.toFixed(2),
      configuredTiers: Object.keys(this.configs).length,
      bucketsPerTier: {} as Record<string, number>,
      health: capacityUsage > 80 ? 'warning' : capacityUsage > 95 ? 'critical' : 'healthy'
    };

    for (const key of this.buckets.keys()) {
      const tier = key.split(':')[1] || 'unknown';
      stats.bucketsPerTier[tier] = (stats.bucketsPerTier[tier] || 0) + 1;
    }

    return stats;
  }

  /**
   * Cleanup expired buckets with memory limits
   */
  cleanup(): void {
    const now = Date.now();

    // Remove expired buckets
    const keysToDelete: string[] = [];
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > this.BUCKET_EXPIRY_MS) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.buckets.delete(key));

    // Enforce hard limit - remove oldest buckets if over limit
    if (this.buckets.size > this.MAX_BUCKETS) {
      const sortedBuckets = Array.from(this.buckets.entries())
        .sort(([, a], [, b]) => a.lastRefill - b.lastRefill);
      
      const toRemove = this.buckets.size - Math.floor(this.MAX_BUCKETS * 0.9);
      for (let i = 0; i < toRemove; i++) {
        this.buckets.delete(sortedBuckets[i][0]);
      }
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop cleanup timer (for testing/shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const rateLimitingService = new RateLimitingService();