import { supabase } from "@/integrations/supabase/client";
import { getTokenAddress, getTokenChainId } from "@/config/tokenAddresses";

export interface GaslessQuote {
  chainId: number;
  price: string;
  guaranteedPrice: string;
  buyAmount: string;
  sellAmount: string;
  buyToken: string;
  sellToken: string;
  allowanceTarget: string;
  to: string;
  from: string;
  issues: {
    allowance: { spender: string; actual: string } | null;
    balance: { token: string; actual: string; expected: string } | null;
    simulationIncomplete: boolean;
    invalidSourcesPassed: string[];
  };
  liquidityAvailable: boolean;
  transaction: {
    to: string;
    data: string;
    gas: string;
    gasPrice: string;
    value: string;
  };
  approval?: {
    type: string;
    hash: string;
    eip712: any;
  };
  trade?: {
    type: string;
    hash: string;
    eip712: any;
  };
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
}

export interface GaslessSubmitResult {
  tradeHash: string;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
}

export interface GaslessStatusResult {
  status: 'pending' | 'submitted' | 'confirmed' | 'failed' | 'expired';
  transactions: Array<{
    hash: string;
    timestamp: number;
    blockNumber?: number;
  }>;
}

class ZeroXGaslessService {
  private readonly ZERO_X_API_URL = 'https://api.0x.org';

  /**
   * Get the appropriate chain ID based on both assets
   * Both assets must be on the same chain
   */
  private getChainId(sellToken: string, buyToken: string): number {
    const sellChainId = getTokenChainId(sellToken);
    const buyChainId = getTokenChainId(buyToken);
    
    if (sellChainId !== buyChainId) {
      throw new Error(`Cross-chain swaps not supported: ${sellToken} (chain ${sellChainId}) -> ${buyToken} (chain ${buyChainId})`);
    }
    
    return sellChainId;
  }

  /**
   * Get a gasless quote from 0x API
   */
  async getGaslessQuote(
    sellToken: string,
    buyToken: string,
    sellAmount: string,
    userAddress: string
  ): Promise<GaslessQuote> {
    const chainId = this.getChainId(sellToken, buyToken);

    console.log('Fetching 0x gasless quote via edge function:', {
      sellToken,
      buyToken,
      sellAmount,
      userAddress,
      chainId
    });

    const { data, error } = await supabase.functions.invoke('swap-0x-gasless', {
      body: {
        operation: 'get_quote',
        sellToken,
        buyToken,
        sellAmount,
        userAddress,
        chainId
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      // Preserve error metadata
      const enhancedError = new Error(`Failed to get gasless quote: ${error.message}`) as any;
      if (data && typeof data === 'object') {
        enhancedError.requestUrl = data.requestUrl;
        enhancedError.requestId = data.requestId;
        enhancedError.statusCode = data.status;
      }
      throw enhancedError;
    }

    if (!data.success) {
      // Preserve debug metadata from edge function error response
      const enhancedError = new Error(data.error || 'Failed to get gasless quote') as any;
      enhancedError.requestUrl = data.requestUrl;
      enhancedError.requestId = data.requestId;
      enhancedError.statusCode = data.status;
      throw enhancedError;
    }

    console.log('0x gasless quote received:', {
      buyAmount: data.quote.buyAmount,
      price: data.quote.price,
      fees: data.quote.fees,
      chainId: data.quote.chainId
    });

    return data.quote;
  }

  /**
   * Submit a gasless swap with signed permit/trade
   */
  async submitGaslessSwap(
    quote: GaslessQuote,
    signature: string,
    quoteId: string,
    intentId: string
  ): Promise<GaslessSubmitResult> {
    console.log('Submitting gasless swap via edge function');

    const { data, error } = await supabase.functions.invoke('swap-0x-gasless', {
      body: {
        operation: 'submit_swap',
        quote,
        signature,
        quoteId,
        intentId
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(`Failed to submit swap: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to submit swap');
    }

    console.log('Gasless swap submitted:', data.result);

    return data.result;
  }

  /**
   * Check the status of a gasless swap
   */
  async getSwapStatus(tradeHash: string): Promise<GaslessStatusResult> {
    const { data, error } = await supabase.functions.invoke('swap-0x-gasless', {
      body: {
        operation: 'get_status',
        tradeHash
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(`Failed to check status: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to check status');
    }

    return data.status;
  }

  /**
   * Poll for swap completion
   */
  async waitForCompletion(
    tradeHash: string,
    maxAttempts: number = 60,
    intervalMs: number = 2000
  ): Promise<GaslessStatusResult> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getSwapStatus(tradeHash);
      
      if (status.status === 'confirmed' || status.status === 'failed' || status.status === 'expired') {
        return status;
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error('Swap timed out');
  }
}

export const zeroXGaslessService = new ZeroXGaslessService();
