/**
 * 0x Gasless API v2 Types
 * Ethereum mainnet only (chainId = 1)
 */

export interface GaslessQuote {
  chainId: number;
  price: string;
  estimatedPriceImpact: string;
  buyAmount: string;
  sellAmount: string;
  buyToken: string;
  sellToken: string;
  allowanceTarget: string;
  to: string;
  from: string;
  
  // Fee breakdown
  fees: {
    integratorFee: {
      amount: string;
      token: string;
      type: string;
    } | null;
    zeroExFee: {
      amount: string;
      token: string;
      type: string;
    } | null;
    gasFee: {
      amount: string;
      token: string;
      type: string;
    } | null;
  };
  
  // EIP-712 signatures required
  trade: {
    eip712: {
      types: Record<string, any>;
      domain: Record<string, any>;
      message: Record<string, any>;
      primaryType: string;
    };
  };
  
  // Optional approval signature (present if allowance issue exists)
  approval?: {
    eip712: {
      types: Record<string, any>;
      domain: Record<string, any>;
      message: Record<string, any>;
      primaryType: string;
    };
  };
  
  // Issues (v2 behavior: allowance is informational, balance blocks)
  issues?: {
    allowance?: {
      spender: string;
      actual: string;
      expected: string;
    } | null;
    balance?: {
      token: string;
      actual: string;
      expected: string;
    } | null;
  };
  
  // Quote metadata
  liquidityAvailable: boolean;
  minBuyAmount: string;
  route: {
    fills: Array<{
      from: string;
      to: string;
      source: string;
      proportionBps: string;
    }>;
  };
  
  // Expiration
  expiry: number;
}

export interface Signatures {
  approval?: string;
  trade: string;
}

export interface GaslessSubmitResult {
  success: boolean;
  tradeHash?: string;
  error?: string;
  message?: string;
  details?: any;
  requestId?: string;
  zid?: string;
  code?: number;
  hint?: 'requote_and_resign' | 'insufficient_balance' | 'stale_signature';
}

export interface GaslessStatusResult {
  status: 'pending' | 'confirmed' | 'failed' | 'submitted';
  transactions?: Array<{
    hash: string;
    timestamp: number;
    blockNumber?: number;
    status: string;
  }>;
  error?: string;
  message?: string;
}

export interface GaslessPrice {
  chainId: number;
  price: string;
  estimatedPriceImpact: string;
  buyAmount: string;
  sellAmount: string;
  buyToken: string;
  sellToken: string;
  fees: {
    integratorFee: {
      amount: string;
      token: string;
    } | null;
    zeroExFee: {
      amount: string;
      token: string;
    } | null;
    gasFee: {
      amount: string;
      token: string;
    } | null;
  };
}
