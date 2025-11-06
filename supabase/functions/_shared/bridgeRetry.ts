/**
 * Exponential backoff retry logic for bridge operations
 */

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const delayMs = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delayMs, config.maxDelayMs);
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-retryable errors
      if (error instanceof NonRetryableError) {
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= finalConfig.maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delayMs = calculateDelay(attempt, finalConfig);
      
      console.log(`[RetryBackoff] Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delayMs}ms...`);
      
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      await delay(delayMs);
    }
  }

  throw new Error(`Operation failed after ${finalConfig.maxRetries + 1} attempts: ${lastError!.message}`);
}

/**
 * Determine if an error is retryable based on its characteristics
 */
export function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    /network/i,
    /timeout/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /rate limit/i,
    /429/,
    /503/,
    /502/,
    /500/,
    /nonce too low/i,
    /replacement transaction underpriced/i,
  ];

  const nonRetryablePatterns = [
    /insufficient funds/i,
    /insufficient balance/i,
    /invalid signature/i,
    /unauthorized/i,
    /forbidden/i,
    /not found/i,
    /invalid address/i,
  ];

  const errorMessage = error.message;

  // Check non-retryable first
  if (nonRetryablePatterns.some(pattern => pattern.test(errorMessage))) {
    return false;
  }

  // Check retryable
  return retryablePatterns.some(pattern => pattern.test(errorMessage));
}

/**
 * Wrap an error in appropriate retry wrapper
 */
export function wrapError(error: Error): Error {
  if (isRetryableError(error)) {
    return new RetryableError(error.message);
  }
  return new NonRetryableError(error.message);
}
