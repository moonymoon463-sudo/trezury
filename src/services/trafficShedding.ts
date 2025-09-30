/**
 * Emergency Traffic Shedding
 * Prioritizes critical operations when backend is under stress
 */

type OperationPriority = 'critical' | 'high' | 'normal' | 'low';

interface OperationConfig {
  name: string;
  priority: OperationPriority;
  enabled: boolean;
}

class TrafficSheddingService {
  private emergencyMode = false;
  private operations = new Map<string, OperationConfig>();
  private requestQueue: Array<{
    priority: OperationPriority;
    operation: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  private processingQueue = false;

  constructor() {
    // Register operation priorities
    this.registerOperation('user-auth', 'critical');
    this.registerOperation('user-balance', 'critical');
    this.registerOperation('transaction-execution', 'critical');
    this.registerOperation('gold-price', 'high');
    this.registerOperation('portfolio-fetch', 'high');
    this.registerOperation('transaction-history', 'normal');
    this.registerOperation('analytics', 'low');
    this.registerOperation('ai-insights', 'low');
    this.registerOperation('news-feed', 'low');
  }

  registerOperation(name: string, priority: OperationPriority) {
    this.operations.set(name, {
      name,
      priority,
      enabled: true,
    });
  }

  enableEmergencyMode() {
    if (!this.emergencyMode) {
      console.warn('[Traffic Shedding] EMERGENCY MODE ACTIVATED');
      this.emergencyMode = true;
      this.shedLowPriorityOperations();
    }
  }

  disableEmergencyMode() {
    if (this.emergencyMode) {
      console.log('[Traffic Shedding] Emergency mode deactivated');
      this.emergencyMode = false;
      this.enableAllOperations();
    }
  }

  private shedLowPriorityOperations() {
    this.operations.forEach(op => {
      if (op.priority === 'low' || op.priority === 'normal') {
        op.enabled = false;
        console.log(`[Traffic Shedding] Disabled: ${op.name}`);
      }
    });
  }

  private enableAllOperations() {
    this.operations.forEach(op => {
      op.enabled = true;
    });
  }

  async executeOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const config = this.operations.get(operationName);
    
    if (!config) {
      console.warn(`[Traffic Shedding] Unknown operation: ${operationName}`);
      return operation();
    }

    // Block low-priority operations in emergency mode
    if (this.emergencyMode && !config.enabled) {
      throw new Error(`Operation ${operationName} blocked due to emergency traffic shedding`);
    }

    // In emergency mode, queue non-critical operations
    if (this.emergencyMode && config.priority !== 'critical') {
      return this.queueOperation(config.priority, operation);
    }

    return operation();
  }

  private queueOperation<T>(
    priority: OperationPriority,
    operation: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        priority,
        operation,
        resolve,
        reject,
      });

      // Sort queue by priority
      this.requestQueue.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      if (!this.processingQueue) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.requestQueue.length > 0 && !this.emergencyMode) {
      const item = this.requestQueue.shift();
      if (!item) continue;

      try {
        const result = await item.operation();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }

      // Small delay between queued operations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.processingQueue = false;
  }

  isEmergencyMode(): boolean {
    return this.emergencyMode;
  }

  getQueueLength(): number {
    return this.requestQueue.length;
  }

  isOperationEnabled(operationName: string): boolean {
    return this.operations.get(operationName)?.enabled ?? true;
  }
}

export const trafficShedding = new TrafficSheddingService();
