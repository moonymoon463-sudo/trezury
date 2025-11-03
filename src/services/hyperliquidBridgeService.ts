import { supabase } from '@/integrations/supabase/client';

export interface BridgeQuoteRequest {
  fromChain: string;
  toChain: string;
  token: string;
  amount: number;
  provider: string;
  destinationAddress: string;
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
  txHash?: string;
  bridgeId?: string;
  error?: string;
}

class HyperliquidBridgeService {
  /**
   * Get a quote for bridging tokens
   */
  async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote> {
    try {
      const { data, error } = await supabase.functions.invoke('hyperliquid-bridge', {
        body: {
          operation: 'get_quote',
          ...request
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
   * Execute a bridge transaction
   */
  async executeBridge(
    userId: string,
    quote: BridgeQuote,
    sourceWalletAddress: string
  ): Promise<BridgeExecutionResult> {
    try {
      const { data, error } = await supabase.functions.invoke('hyperliquid-bridge', {
        body: {
          operation: 'execute_bridge',
          userId,
          quote,
          sourceWalletAddress
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[HyperliquidBridge] Execution error:', error);
      throw error;
    }
  }

  /**
   * Check bridge transaction status
   */
  async checkBridgeStatus(bridgeId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
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
      stargate: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'bsc', 'avalanche'],
      native: ['arbitrum', 'ethereum']
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
      stargate: {
        ethereum: '1 - 5min',
        arbitrum: '1 - 3min',
        optimism: '1 - 5min',
        polygon: '2 - 5min',
        bsc: '2 - 5min',
        avalanche: '2 - 5min'
      },
      native: {
        arbitrum: '5 - 10min',
        ethereum: '5 - 10min'
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
      stargate: 0.002, // 0.2%
      native: 0.001 // 0.1%
    };

    const rate = feeRates[provider] || 0.005;
    return amount * rate;
  }
}

export const hyperliquidBridgeService = new HyperliquidBridgeService();
