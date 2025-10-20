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
   * Get a quote from 0x Swap API with our platform fee included
   */
  async getQuote(
    sellToken: string,
    buyToken: string,
    sellAmount: string,
    userAddress: string
  ): Promise<ZeroXQuote> {
    const sellTokenAddress = this.getTokenAddress(sellToken);
    const buyTokenAddress = this.getTokenAddress(buyToken);

    const params = new URLSearchParams({
      chainId: '1', // ✅ Always 1 for Ethereum mainnet in this service
      sellToken: sellTokenAddress,
      buyToken: buyTokenAddress,
      sellAmount: sellAmount,
      taker: userAddress, // v2 parameter
      slippagePercentage: '0.005', // 0.5% slippage (0x recommends 0.5-1%)
      swapFeeRecipient: PLATFORM_FEE_RECIPIENT, // v2 parameter - EOA wallet
      swapFeeBps: String(PLATFORM_FEE_BPS), // v2 parameter (0.8% platform fee)
      swapFeeToken: buyTokenAddress, // v2 parameter - fee collected in output token
      tradeSurplusRecipient: userAddress, // v2 parameter - optional but recommended
      skipValidation: 'false'
    });

    console.log('🔍 0x v2 Permit2 Quote Request:', {
      endpoint: '/swap/permit2/quote',
      chainId: '1',
      sellToken,
      buyToken,
      sellAmount,
      userAddress,
      headers: {
        '0x-api-key': import.meta.env.VITE_ZERO_X_API_KEY ? '✅ Present' : '❌ Missing',
        '0x-version': 'v2'
      }
    });

    const response = await fetch(`${this.ZERO_X_API_URL}/swap/permit2/quote?${params}`, {
      headers: {
        '0x-api-key': import.meta.env.VITE_ZERO_X_API_KEY || '',
        '0x-version': 'v2' // Required for v2 API
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorObj;
      try {
        errorObj = JSON.parse(errorText);
      } catch {
        errorObj = { message: errorText };
      }
      
      console.error('0x API v2 error:', {
        status: response.status,
        requestId: response.headers.get('x-request-id'),
        error: errorObj
      });
      
      throw new Error(errorObj.message || errorText);
    }

    const quote = await response.json();
    console.log('✅ 0x quote received:', {
      buyAmount: quote.buyAmount,
      price: quote.price,
      allowanceTarget: quote.allowanceTarget, // ✅ Critical field
      hasApproval: !!quote.approval,
      hasTrade: !!quote.trade,
      sources: quote.sources
    });

    return quote;
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
