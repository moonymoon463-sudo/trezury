/**
 * Production Monitoring Utilities
 * Provides structured logging and metrics for swap operations
 */

export type SwapEventType =
  | 'swap_initiated'
  | 'swap_broadcasted'
  | 'swap_settled'
  | 'swap_failed'
  | 'idempotency_rejected'
  | 'chain_id_mismatch'
  | 'token_verification_failed'
  | 'slippage_cap_exceeded'
  | 'approval_reset'
  | 'approval_set';

export interface SwapMetrics {
  orderId: string;
  userId: string;
  eventType: SwapEventType;
  timestamp: string;
  metadata: {
    inputAsset?: string;
    outputAsset?: string;
    inputAmount?: number;
    outputAmount?: number;
    txHash?: string;
    errorMessage?: string;
    slippage?: number;
    chainId?: number;
    idempotencyKey?: string;
    [key: string]: any;
  };
}

/**
 * Log a swap event with structured data
 */
export function logSwapEvent(
  orderId: string,
  userId: string,
  eventType: SwapEventType,
  metadata: Record<string, any> = {}
): void {
  const event: SwapMetrics = {
    orderId,
    userId,
    eventType,
    timestamp: new Date().toISOString(),
    metadata
  };

  // Log to console with structured JSON for production monitoring
  console.log('[SWAP_EVENT]', JSON.stringify(event));
}

/**
 * Log critical production issues that need immediate attention
 */
export function logCriticalIssue(
  issue: string,
  metadata: Record<string, any> = {}
): void {
  console.error('[CRITICAL_ISSUE]', JSON.stringify({
    issue,
    timestamp: new Date().toISOString(),
    metadata
  }));
}

/**
 * Log production warning that should be monitored
 */
export function logProductionWarning(
  warning: string,
  metadata: Record<string, any> = {}
): void {
  console.warn('[PRODUCTION_WARNING]', JSON.stringify({
    warning,
    timestamp: new Date().toISOString(),
    metadata
  }));
}
