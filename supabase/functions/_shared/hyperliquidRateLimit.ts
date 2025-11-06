/**
 * Rate limiting and request management for Hyperliquid API
 * Limits: 10 requests/second per IP (Hyperliquid recommendation)
 */

interface RateLimitState {
  requests: number[];
  lastCleanup: number;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

class HyperliquidRateLimiter {
  private state: RateLimitState = {
    requests: [],
    lastCleanup: Date.now()
  };
  
  private readonly maxRequestsPerSecond = 10;
  private readonly windowMs = 1000;
  private readonly cleanupInterval = 5000;
  
  // Request deduplication
  private pendingRequests = new Map<string, PendingRequest[]>();
  
  /**
   * Check if we can make a request without exceeding rate limit
   */
  canMakeRequest(): boolean {
    this.cleanup();
    return this.state.requests.length < this.maxRequestsPerSecond;
  }
  
  /**
   * Record a request for rate limiting
   */
  recordRequest(): void {
    this.cleanup();
    this.state.requests.push(Date.now());
  }
  
  /**
   * Wait until we can make a request
   */
  async waitForAvailability(): Promise<void> {
    while (!this.canMakeRequest()) {
      const oldestRequest = this.state.requests[0];
      const waitTime = Math.max(0, this.windowMs - (Date.now() - oldestRequest));
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime + 10));
      }
      this.cleanup();
    }
  }
  
  /**
   * Deduplicate concurrent identical requests
   */
  async deduplicateRequest<T>(
    key: string, 
    executor: () => Promise<T>
  ): Promise<T> {
    // Check if this request is already pending
    if (this.pendingRequests.has(key)) {
      console.log('[RateLimit] Deduplicating request:', key);
      return new Promise((resolve, reject) => {
        this.pendingRequests.get(key)!.push({ resolve, reject, timestamp: Date.now() });
      });
    }
    
    // Create new pending request
    this.pendingRequests.set(key, []);
    
    try {
      const result = await executor();
      
      // Resolve all waiting requests
      const waiting = this.pendingRequests.get(key) || [];
      waiting.forEach(req => req.resolve(result));
      this.pendingRequests.delete(key);
      
      return result;
    } catch (error) {
      // Reject all waiting requests
      const waiting = this.pendingRequests.get(key) || [];
      waiting.forEach(req => req.reject(error));
      this.pendingRequests.delete(key);
      
      throw error;
    }
  }
  
  /**
   * Cleanup old requests from the sliding window
   */
  private cleanup(): void {
    const now = Date.now();
    
    // Remove requests older than the window
    this.state.requests = this.state.requests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    
    // Periodic cleanup of stale pending requests (older than 30s)
    if (now - this.state.lastCleanup > this.cleanupInterval) {
      for (const [key, requests] of this.pendingRequests.entries()) {
        const stale = requests.filter(req => now - req.timestamp > 30000);
        if (stale.length > 0) {
          console.warn('[RateLimit] Cleaning up stale requests:', key, stale.length);
          this.pendingRequests.delete(key);
        }
      }
      this.state.lastCleanup = now;
    }
  }
  
  /**
   * Get current rate limit metrics
   */
  getMetrics() {
    this.cleanup();
    return {
      currentRequests: this.state.requests.length,
      maxRequests: this.maxRequestsPerSecond,
      utilizationPercent: (this.state.requests.length / this.maxRequestsPerSecond) * 100,
      pendingDeduplications: this.pendingRequests.size
    };
  }
}

export const rateLimiter = new HyperliquidRateLimiter();

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry client errors (4xx except 429)
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }
      
      // Last attempt - throw error
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}
