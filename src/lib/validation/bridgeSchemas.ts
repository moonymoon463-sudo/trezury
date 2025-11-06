import { z } from 'zod';

// Ethereum address validation
const ethereumAddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
  .transform(addr => addr.toLowerCase());

// Chain-specific transaction limits (in USDC)
export const BRIDGE_LIMITS = {
  ethereum: { min: 10, max: 100000 },
  arbitrum: { min: 10, max: 100000 },
  optimism: { min: 10, max: 100000 },
  polygon: { min: 10, max: 50000 },
  base: { min: 10, max: 50000 },
  bsc: { min: 10, max: 50000 },
  avalanche: { min: 10, max: 50000 },
} as const;

// Bridge quote request validation
export const bridgeQuoteRequestSchema = z.object({
  fromChain: z.enum(['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'bsc', 'avalanche']),
  toChain: z.literal('hyperliquid'),
  token: z.literal('USDC'),
  amount: z.number()
    .positive('Amount must be positive')
    .finite('Amount must be a valid number'),
  provider: z.enum(['across', 'wormhole']),
  destinationAddress: ethereumAddressSchema,
  sourceWalletAddress: ethereumAddressSchema.optional(),
});

// Bridge execution validation
export const bridgeExecutionSchema = z.object({
  quote: z.object({
    provider: z.enum(['across', 'wormhole']),
    fromChain: z.enum(['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'bsc', 'avalanche']),
    toChain: z.literal('hyperliquid'),
    inputAmount: z.number().positive(),
    estimatedOutput: z.number().positive(),
    fee: z.number().nonnegative(),
    estimatedTime: z.string(),
    route: z.object({
      destinationAddress: ethereumAddressSchema,
      token: z.literal('USDC'),
      confirmations: z.number().int().positive(),
    }),
  }),
  sourceWalletAddress: ethereumAddressSchema,
  sourceWalletType: z.enum(['internal', 'external']),
  password: z.string().min(1).optional(),
});

// Validate amount against chain limits
export function validateBridgeAmount(chain: string, amount: number): { valid: boolean; error?: string } {
  const limits = BRIDGE_LIMITS[chain as keyof typeof BRIDGE_LIMITS];
  
  if (!limits) {
    return { valid: false, error: `Unsupported chain: ${chain}` };
  }
  
  if (amount < limits.min) {
    return { valid: false, error: `Minimum bridge amount for ${chain} is ${limits.min} USDC` };
  }
  
  if (amount > limits.max) {
    return { valid: false, error: `Maximum bridge amount for ${chain} is ${limits.max} USDC` };
  }
  
  return { valid: true };
}

export type BridgeQuoteRequest = z.infer<typeof bridgeQuoteRequestSchema>;
export type BridgeExecution = z.infer<typeof bridgeExecutionSchema>;
