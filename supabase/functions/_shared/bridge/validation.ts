/**
 * Validation utilities for bridge operations
 */

import { BRIDGE_LIMITS } from './config.ts';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate Ethereum address format
 */
export function validateAddress(address: string): void {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new ValidationError('Invalid Ethereum address format');
  }
}

/**
 * Validate amount is positive and within limits
 */
export function validateAmount(amount: number | string, chain: string): number {
  const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new ValidationError(`Invalid amount: ${amount}`);
  }

  const limits = BRIDGE_LIMITS[chain];
  if (!limits) {
    throw new ValidationError(`Unsupported chain: ${chain}`);
  }

  if (parsedAmount < limits.min) {
    throw new ValidationError(`Minimum bridge amount for ${chain} is ${limits.min} USDC`);
  }

  if (parsedAmount > limits.max) {
    throw new ValidationError(`Maximum bridge amount for ${chain} is ${limits.max} USDC`);
  }

  return parsedAmount;
}

/**
 * Validate quote request parameters
 */
export function validateQuoteRequest(params: any): void {
  const { fromChain, toChain, token, amount, provider, destinationAddress } = params;

  if (!fromChain || typeof fromChain !== 'string') {
    throw new ValidationError('Invalid fromChain parameter');
  }

  if (toChain !== 'hyperliquid') {
    throw new ValidationError('Only Hyperliquid is supported as destination');
  }

  if (token !== 'USDC') {
    throw new ValidationError('Only USDC is supported');
  }

  if (!['across', 'wormhole'].includes(provider)) {
    throw new ValidationError('Invalid bridge provider');
  }

  validateAddress(destinationAddress);
  validateAmount(amount, fromChain);
}

/**
 * Validate bridge execution parameters
 */
export function validateExecutionRequest(params: any): void {
  const { quote, sourceWalletAddress, sourceWalletType, password } = params;

  if (!quote || typeof quote !== 'object') {
    throw new ValidationError('Invalid quote object');
  }

  if (!sourceWalletAddress) {
    throw new ValidationError('Source wallet address is required');
  }

  validateAddress(sourceWalletAddress);

  if (!['internal', 'external'].includes(sourceWalletType)) {
    throw new ValidationError('Invalid wallet type');
  }

  if (sourceWalletType === 'internal' && !password) {
    throw new ValidationError('Password required for internal wallet');
  }
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): void {
  const required = ['WALLET_ENCRYPTION_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missing = required.filter(key => !Deno.env.get(key));

  if (missing.length > 0) {
    throw new ValidationError(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Check API keys based on usage
  const infuraKey = Deno.env.get('INFURA_API_KEY');
  const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');

  if (!infuraKey && !alchemyKey) {
    console.warn('[Bridge] Warning: No RPC API keys configured. Some chains may not work.');
  }
}
