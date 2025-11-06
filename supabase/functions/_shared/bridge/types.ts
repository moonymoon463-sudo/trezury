/**
 * Type definitions for bridge operations
 */

export interface BridgeQuote {
  provider: 'across' | 'wormhole';
  fromChain: string;
  toChain: string;
  inputAmount: number;
  estimatedOutput: number;
  fee: number;
  estimatedTime: string;
  gasEstimate: string;
  route: {
    destinationAddress: string;
    token: string;
    confirmations: number;
  };
}

export interface QuoteParams {
  fromChain: string;
  toChain: string;
  token: string;
  amount: number;
  destinationAddress: string;
}

export interface UnsignedTransaction {
  to: string;
  from: string;
  data: string;
  value: string;
}

export interface BridgeExecutionParams {
  quote: BridgeQuote;
  sourceWalletAddress: string;
  sourceWalletType: 'internal' | 'external';
  password?: string;
}

export interface BridgeExecutionResult {
  success: boolean;
  bridgeId: string;
  txHash?: string;
  estimatedCompletion?: string;
  requiresSignature?: boolean;
  unsignedTransaction?: any;
  message?: string;
  note: string;
  error?: string;
}

export interface BridgeProvider {
  readonly name: string;
  getSupportedChains(): string[];
  getQuote(params: QuoteParams): Promise<BridgeQuote>;
  prepareTransaction(quote: BridgeQuote, fromAddress: string): Promise<any>;
  executeTransaction(
    quote: BridgeQuote,
    privateKey: string,
    bridgeId: string,
    supabaseClient: any
  ): Promise<{ txHash: string }>;
}
