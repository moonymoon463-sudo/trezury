/**
 * 0x Gasless Swap Service v2
 * Ethereum mainnet only (chainId = 1)
 * 
 * Clean wrapper around swap-0x-gasless edge function
 */

import { supabase } from '@/integrations/supabase/client';
import { GaslessQuote, GaslessSubmitResult, GaslessStatusResult, GaslessPrice, Signatures } from '@/types/gasless';
import { getTokenAddress } from '@/config/tokenAddresses';

const ETHEREUM_CHAIN_ID = 1;

class GaslessSwapV2Service {
  /**
   * Get indicative price for a swap (no signatures required)
   */
  async getIndicativePrice(
    sellSymbol: string,
    buySymbol: string,
    sellAmount: string
  ): Promise<GaslessPrice> {
    const sellToken = getTokenAddress(sellSymbol);
    const buyToken = getTokenAddress(buySymbol);

    const { data, error } = await supabase.functions.invoke('swap-0x-gasless', {
      body: {
        operation: 'get_price',
        chainId: ETHEREUM_CHAIN_ID,
        sellToken,
        buyToken,
        sellAmount
      }
    });

    if (error) {
      throw new Error(`Failed to get price: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(data.message || data.error || 'Failed to get indicative price');
    }

    return data.quote;
  }

  /**
   * Get firm quote with EIP-712 payloads for signing
   */
  async getQuote(
    sellSymbol: string,
    buySymbol: string,
    sellAmount: string,
    userAddress: string,
    options?: {
      feeTokenStrategy?: 'buy' | 'sell';
      includedSources?: string[];
      excludedSources?: string[];
    }
  ): Promise<GaslessQuote> {
    const sellToken = getTokenAddress(sellSymbol);
    const buyToken = getTokenAddress(buySymbol);

    const { data, error } = await supabase.functions.invoke('swap-0x-gasless', {
      body: {
        operation: 'get_quote',
        chainId: ETHEREUM_CHAIN_ID,
        sellToken,
        buyToken,
        sellAmount,
        userAddress,
        feeTokenStrategy: options?.feeTokenStrategy,
        includedSources: options?.includedSources,
        excludedSources: options?.excludedSources
      }
    });

    if (error) {
      throw new Error(`Failed to get quote: ${error.message}`);
    }

    if (!data.success) {
      const errorData = {
        message: data.message || data.error || 'Failed to get quote',
        requestId: data.requestId,
        zid: data.zid,
        hint: data.hint,
        details: data.details
      };
      const error = new Error(errorData.message) as any;
      error.requestId = errorData.requestId;
      error.zid = errorData.zid;
      error.hint = errorData.hint;
      error.details = errorData.details;
      throw error;
    }

    return data.quote;
  }

  /**
   * Submit signed swap to 0x
   */
  async submitSwap(
    quote: GaslessQuote,
    signatures: Signatures,
    quoteId: string,
    intentId: string
  ): Promise<GaslessSubmitResult> {
    const { data, error } = await supabase.functions.invoke('swap-0x-gasless', {
      body: {
        operation: 'submit_swap',
        quote,
        signatures,
        quoteId,
        intentId
      }
    });

    if (error) {
      throw new Error(`Failed to submit swap: ${error.message}`);
    }

    // Edge function returns normalized 200 responses
    return data as GaslessSubmitResult;
  }

  /**
   * Get status of submitted swap
   */
  async getStatus(tradeHash: string): Promise<GaslessStatusResult> {
    const { data, error } = await supabase.functions.invoke('swap-0x-gasless', {
      body: {
        operation: 'get_status',
        tradeHash,
        chainId: ETHEREUM_CHAIN_ID
      }
    });

    if (error) {
      throw new Error(`Failed to get status: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(data.message || data.error || 'Failed to get swap status');
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
      const status = await this.getStatus(tradeHash);
      
      if (status.status === 'confirmed' || status.status === 'failed') {
        return status;
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    throw new Error('Swap confirmation timeout');
  }
}

export const gaslessSwapV2Service = new GaslessSwapV2Service();
