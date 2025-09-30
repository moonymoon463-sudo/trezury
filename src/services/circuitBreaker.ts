/**
 * Circuit Breaker Pattern for Supabase Operations
 * Prevents cascading failures by failing fast when backend is unhealthy
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  state: CircuitState;
}

class CircuitBreaker {
  private circuits = new Map<string, CircuitStats>();
  private configs = new Map<string, CircuitConfig>();

  constructor() {
    this.registerCircuit('supabase-main', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 10000,
      resetTimeout: 30000,
    });

    this.registerCircuit('gold-price', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 5000,
      resetTimeout: 60000,
    });

    this.registerCircuit('user-operations', {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 10000,
      resetTimeout: 30000,
    });
  }

  registerCircuit(name: string, config: CircuitConfig) {
    this.configs.set(name, config);
    this.circuits.set(name, {
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      state: 'CLOSED',
    });
  }

  async execute<T>(
    circuitName: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    const circuit = this.circuits.get(circuitName);
    const config = this.configs.get(circuitName);

    if (!circuit || !config) {
      console.warn(`[Circuit Breaker] Unknown circuit: ${circuitName}`);
      return operation();
    }

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (circuit.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - (circuit.lastFailureTime || 0);
      if (timeSinceLastFailure > config.resetTimeout) {
        console.log(`[Circuit Breaker] ${circuitName}: OPEN -> HALF_OPEN (timeout)`);
        circuit.state = 'HALF_OPEN';
        circuit.successes = 0;
      } else {
        console.warn(`[Circuit Breaker] ${circuitName}: Circuit OPEN, using fallback`);
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Circuit breaker ${circuitName} is OPEN`);
      }
    }

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Circuit timeout')), config.timeout)
        ),
      ]);

      this.onSuccess(circuitName);
      return result;
    } catch (error) {
      this.onFailure(circuitName);
      console.error(`[Circuit Breaker] ${circuitName}: Operation failed`, error);

      if (fallback) {
        console.log(`[Circuit Breaker] ${circuitName}: Using fallback`);
        return await fallback();
      }

      throw error;
    }
  }

  private onSuccess(circuitName: string) {
    const circuit = this.circuits.get(circuitName);
    const config = this.configs.get(circuitName);
    if (!circuit || !config) return;

    circuit.failures = 0;
    circuit.successes++;

    if (circuit.state === 'HALF_OPEN' && circuit.successes >= config.successThreshold) {
      console.log(`[Circuit Breaker] ${circuitName}: HALF_OPEN -> CLOSED`);
      circuit.state = 'CLOSED';
      circuit.successes = 0;
    }
  }

  private onFailure(circuitName: string) {
    const circuit = this.circuits.get(circuitName);
    const config = this.configs.get(circuitName);
    if (!circuit || !config) return;

    circuit.failures++;
    circuit.lastFailureTime = Date.now();
    circuit.successes = 0;

    if (circuit.failures >= config.failureThreshold) {
      console.warn(`[Circuit Breaker] ${circuitName}: ${circuit.state} -> OPEN`);
      circuit.state = 'OPEN';
    }
  }

  getState(circuitName: string): CircuitState {
    return this.circuits.get(circuitName)?.state || 'CLOSED';
  }

  getStats(circuitName: string) {
    return this.circuits.get(circuitName);
  }

  reset(circuitName: string) {
    const circuit = this.circuits.get(circuitName);
    if (circuit) {
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.state = 'CLOSED';
      circuit.lastFailureTime = null;
      console.log(`[Circuit Breaker] ${circuitName}: Reset to CLOSED`);
    }
  }

  forceOpen(circuitName: string) {
    const circuit = this.circuits.get(circuitName);
    if (circuit) {
      circuit.state = 'OPEN';
      circuit.lastFailureTime = Date.now();
      console.warn(`[Circuit Breaker] ${circuitName}: Force opened`);
    }
  }
}

export const circuitBreaker = new CircuitBreaker();
