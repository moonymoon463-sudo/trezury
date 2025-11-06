/**
 * Production Monitoring Utilities
 * Provides structured logging and metrics for swap operations
 * @deprecated Use logger from @/utils/logger instead
 */

import { logger } from './logger';

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
  logger.setContext({ userId, orderId, component: 'swap' });
  
  const event: SwapMetrics = {
    orderId,
    userId,
    eventType,
    timestamp: new Date().toISOString(),
    metadata
  };

  if (eventType === 'swap_failed') {
    logger.error(`Swap event: ${eventType}`, event);
  } else if (eventType.includes('rejected') || eventType.includes('exceeded')) {
    logger.warn(`Swap event: ${eventType}`, event);
  } else {
    logger.info(`Swap event: ${eventType}`, event);
  }
  
  logger.clearContext();
}

/**
 * Log critical production issues that need immediate attention
 */
export function logCriticalIssue(
  issue: string,
  metadata: Record<string, any> = {}
): void {
  logger.critical(issue, metadata);
}

/**
 * Log production warning that should be monitored
 */
export function logProductionWarning(
  warning: string,
  metadata: Record<string, any> = {}
): void {
  logger.warn(warning, metadata);
}
