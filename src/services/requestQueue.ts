/**
 * Request Queue Service - Prevents duplicate requests and implements throttling
 */

interface QueueItem {
  key: string;
  operation: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

class RequestQueue {
  private queue = new Map<string, QueueItem>();
  private inFlight = new Map<string, Promise<any>>();
  private lastExecution = new Map<string, number>();
  private readonly throttleMs = 2000; // 2 seconds minimum between requests

  /**
   * Execute an operation with deduplication and throttling
   */
  async execute<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // Check if there's already an in-flight request for this key
    const existing = this.inFlight.get(key);
    if (existing) {
      console.log(`[RequestQueue] Reusing in-flight request for: ${key}`);
      return existing as Promise<T>;
    }

    // Check throttle
    const lastExec = this.lastExecution.get(key);
    const now = Date.now();
    if (lastExec && now - lastExec < this.throttleMs) {
      const waitTime = this.throttleMs - (now - lastExec);
      console.log(`[RequestQueue] Throttling ${key}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Execute the operation
    const promise = (async () => {
      try {
        console.log(`[RequestQueue] Executing: ${key}`);
        const result = await operation();
        this.lastExecution.set(key, Date.now());
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise as Promise<T>;
  }

  /**
   * Cancel any pending requests for a given key
   */
  cancel(key: string): void {
    this.queue.delete(key);
    this.inFlight.delete(key);
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.queue.clear();
    this.inFlight.clear();
  }

  /**
   * Get statistics about the queue
   */
  getStats() {
    return {
      queued: this.queue.size,
      inFlight: this.inFlight.size,
      lastExecutions: Array.from(this.lastExecution.entries())
        .map(([key, time]) => ({ key, age: Date.now() - time })),
    };
  }
}

export const requestQueue = new RequestQueue();
