import { supabase } from "@/integrations/supabase/client";
import { TOKEN_ADDRESSES, TOKEN_DECIMALS, getTokenAddress, getTokenDecimals } from "@/config/tokenAddresses";
import { PLATFORM_FEE_RECIPIENT, PLATFORM_FEE_BPS } from "@/config/platformFees";

export interface ZeroXQuote {
  buyAmount: string;
  sellAmount: string;
  price: string;
  guaranteedPrice: string;
  estimatedGas: string;
  to: string;
  data: string;
  allowanceTarget: string; // ✅ CRITICAL: Where to approve tokens (AllowanceHolder or Permit2)
  buyTokenAddress: string;
  sellTokenAddress: string;
  sources: Array<{ name: string; proportion: string }>;
  
  // ✅ EIP-712 signature data for permit2 flow
  approval?: {
    type: string;
    hash: string;
    eip712: {
      domain: any;
      types: any;
      message: any;
      primaryType: string;
    };
  };
  trade?: {
    type: string;
    hash: string;
    eip712: {
      domain: any;
      types: any;
      message: any;
      primaryType: string;
    };
  };
}

class ZeroXSwapService {
  private readonly ZERO_X_API_URL = 'https://api.0x.org';

  getTokenAddress(symbol: string): string {
    return getTokenAddress(symbol);
  }

  getTokenDecimals(symbol: string): number {
    return getTokenDecimals(symbol);
  }

  /**
   * Get indicative price via edge function (no balance check)
   * Used as fallback when gasless quote fails
   */
  async getPrice(
    sellToken: string,
    buyToken: string,
    sellAmount: string,
    chainId: number
  ): Promise<{ buyAmount: string; price: string; buyTokenAddress: string; sellTokenAddress: string }> {
    console.log('Fetching indicative price via edge function:', {
      sellToken,
      buyToken,
      sellAmount,
      chainId
    });

    const { data, error } = await supabase.functions.invoke('swap-0x-gasless', {
      body: {
        operation: 'get_price',
        sellToken,
        buyToken,
        sellAmount,
        chainId
      }
    });

    if (error) {
      console.error('Edge function price error:', error);
      throw new Error(`Failed to fetch price: ${error.message}`);
    }

    if (!data?.success) {
      const message = data?.message || data?.error || 'Failed to fetch price';
      console.error('Price fetch failed:', { error: data?.error, message });
      
      // Provide specific error messages for common cases
      if (data?.error === 'no_route' || message.includes('no liquidity') || message.includes('not supported')) {
        throw new Error(message);
      } else if (data?.error === 'api_error' && (message.includes('401') || message.includes('403'))) {
        throw new Error('API authentication failed. Please check configuration.');
      } else if (message.includes('rate limit') || message.includes('429')) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      
      throw new Error(message);
    }

    console.log('Indicative price received:', { buyAmount: data.price.buyAmount, price: data.price.price });

    return {
      buyAmount: data.price.buyAmount,
      price: data.price.price,
      buyTokenAddress: data.price.buyTokenAddress,
      sellTokenAddress: data.price.sellTokenAddress
    };
  }

  /**
   * Get a quote from 0x Swap API via edge function (secure, no VITE key exposure)
   */
  async getQuote(
    sellToken: string,
    buyToken: string,
    sellAmount: string,
    userAddress: string
  ): Promise<ZeroXQuote> {
    console.log('🔍 Fetching 0x permit2 quote via edge function:', {
      sellToken,
      buyToken,
      sellAmount,
      userAddress
    });

    const { data, error } = await supabase.functions.invoke('swap-0x-gasless', {
      body: {
        operation: 'get_permit2_quote',
        sellToken,
        buyToken,
        sellAmount,
        userAddress,
        chainId: 1 // Ethereum mainnet
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(`Failed to get quote: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(data.error || data.message || 'Failed to get quote');
    }

    console.log('✅ 0x permit2 quote received:', {
      buyAmount: data.quote.buyAmount,
      price: data.quote.price,
      allowanceTarget: data.quote.allowanceTarget,
      hasApproval: !!data.quote.approval,
      hasTrade: !!data.quote.trade
    });

    return data.quote;
  }

  /**
   * Execute swap via blockchain-operations edge function
   */
  async executeSwap(
    quote: ZeroXQuote,
    sellToken: string,
    buyToken: string,
    userAddress: string,
    walletPassword: string,
    quoteId: string,
    intentId: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    console.log('Executing 0x swap via edge function');

    const { data, error } = await supabase.functions.invoke('blockchain-operations', {
      body: {
        operation: 'execute_0x_swap',
        quote,
        sellToken,
        buyToken,
        userAddress,
        walletPassword,
        quoteId,
        intentId
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      return { success: false, error: error.message };
    }

    return data;
  }
}

export const zeroXSwapService = new ZeroXSwapService();
