import { supabase } from '@/integrations/supabase/client';
import { 
  bridgeQuoteRequestSchema, 
  bridgeExecutionSchema, 
  validateBridgeAmount,
  type BridgeQuoteRequest as ValidatedBridgeQuoteRequest 
} from '@/lib/validation/bridgeSchemas';

export interface BridgeQuoteRequest {
  fromChain: string;
  toChain: string;
  token: string;
  amount: number;
  provider: string;
  destinationAddress: string;
  sourceWalletAddress?: string;
}

export interface BridgeQuote {
  provider: string;
  fromChain: string;
  toChain: string;
  inputAmount: number;
  estimatedOutput: number;
  fee: number;
  estimatedTime: string;
  route: any;
}

export interface BridgeExecutionResult {
  success: boolean;
  bridgeId?: string;
  txHash?: string;
  error?: string;
  requiresSignature?: boolean;
  unsignedTransaction?: any;
  note?: string;
}

class HyperliquidBridgeService {
  /**
   * Get a quote for bridging tokens with validation
   */
  async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote> {
    try {
      // Validate request
      const validatedRequest = bridgeQuoteRequestSchema.parse(request);
      
      // Validate amount against chain limits
      const amountValidation = validateBridgeAmount(validatedRequest.fromChain, validatedRequest.amount);
      if (!amountValidation.valid) {
        throw new Error(amountValidation.error);
      }

      const { data, error } = await supabase.functions.invoke('hyperliquid-bridge', {
        body: {
          operation: 'get_quote',
          ...validatedRequest
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[HyperliquidBridge] Quote error:', error);
      throw error;
    }
  }

  /**
   * Execute a bridge transaction with validation
   */
  async executeBridge(
    userId: string,
    quote: BridgeQuote,
    sourceWalletAddress: string,
    sourceWalletType: 'internal' | 'external' = 'external',
    password?: string
  ): Promise<BridgeExecutionResult> {
    try {
      // Validate execution parameters
      const validatedParams = bridgeExecutionSchema.parse({
        quote,
        sourceWalletAddress,
        sourceWalletType,
        password,
      });

      console.log('[BridgeService] Executing bridge:', {
        provider: quote.provider,
        fromChain: quote.fromChain,
        toChain: quote.toChain,
        amount: quote.inputAmount,
        sourceWalletType,
      });

      const { data, error } = await supabase.functions.invoke('hyperliquid-bridge', {
        body: {
          operation: 'execute_bridge',
          userId,
          ...validatedParams,
        },
      });

      if (error) throw error;
      if (!data) throw new Error('No response from bridge service');

      // If external wallet, data will contain unsigned transaction
      if (data.requiresSignature) {
        return {
          success: true,
          requiresSignature: true,
          unsignedTransaction: data.unsignedTransaction,
          bridgeId: data.bridgeId,
          note: data.note,
        };
      }

      return data;
    } catch (error) {
      console.error('[BridgeService] Execute error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute bridge',
      };
    }
  }

  /**
   * Check bridge transaction status
   */
  async checkBridgeStatus(bridgeId: string): Promise<{
    status: 'pending' | 'processing' | 'step1_complete' | 'processing_step2' | 'completed' | 'failed';
    txHash?: string;
    destinationTxHash?: string;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('hyperliquid-bridge', {
        body: {
          operation: 'check_status',
          bridgeId
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[HyperliquidBridge] Status check error:', error);
      throw error;
    }
  }

  /**
   * Get supported chains for a specific bridge provider
   */
  getSupportedChains(provider: string): string[] {
    const chainSupport: Record<string, string[]> = {
      across: ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon', 'bsc'],
      wormhole: ['avalanche', 'ethereum', 'bsc', 'polygon']
    };

    return chainSupport[provider] || [];
  }

  /**
   * Estimate bridge time
   */
  estimateBridgeTime(provider: string, fromChain: string): string {
    const timeEstimates: Record<string, Record<string, string>> = {
      across: {
        ethereum: '30s - 2min',
        arbitrum: '30s - 1min',
        optimism: '30s - 2min',
        base: '30s - 2min',
        polygon: '1 - 3min',
        bsc: '1 - 3min'
      },
      wormhole: {
        avalanche: '5 - 15min',
        ethereum: '10 - 20min',
        bsc: '5 - 15min',
        polygon: '5 - 15min'
      }
    };

    return timeEstimates[provider]?.[fromChain] || '5 - 10min';
  }

  /**
   * Calculate bridge fee estimate
   */
  estimateFee(provider: string, amount: number): number {
    const feeRates: Record<string, number> = {
      across: 0.003, // 0.3%
      wormhole: 0.001 // 0.1%
    };

    const rate = feeRates[provider] || 0.005;
    return amount * rate;
  }
}

export const hyperliquidBridgeService = new HyperliquidBridgeService();
