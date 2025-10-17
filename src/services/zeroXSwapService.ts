import { supabase } from "@/integrations/supabase/client";
import { TOKEN_ADDRESSES, TOKEN_DECIMALS, getTokenAddress, getTokenDecimals } from "@/config/tokenAddresses";

export interface ZeroXQuote {
  buyAmount: string;
  sellAmount: string;
  price: string;
  guaranteedPrice: string;
  estimatedGas: string;
  to: string;
  data: string;
  allowanceTarget: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  sources: Array<{ name: string; proportion: string }>;
}

class ZeroXSwapService {
  private readonly ZERO_X_API_URL = 'https://api.0x.org';
  private readonly PLATFORM_FEE_BPS = 80; // 0.8%
  private readonly PLATFORM_FEE_RECIPIENT = '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835';

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

    if (!data.success) {
      console.error('Price fetch failed:', data.error);
      throw new Error(data.error || 'Failed to fetch price');
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
      sellToken: sellTokenAddress,
      buyToken: buyTokenAddress,
      sellAmount: sellAmount,
      taker: userAddress, // v2 parameter
      slippagePercentage: '0.005', // 0.5% slippage (0x recommends 0.5-1%)
      swapFeeRecipient: this.PLATFORM_FEE_RECIPIENT, // v2 parameter
      swapFeeBps: '80', // v2 parameter (0.8% platform fee)
      swapFeeToken: buyTokenAddress, // v2 parameter - fee collected in output token
      tradeSurplusRecipient: userAddress, // v2 parameter - optional but recommended
      skipValidation: 'false'
    });

    console.log('Fetching 0x quote:', {
      sellToken,
      buyToken,
      sellAmount,
      userAddress
    });

    const response = await fetch(`${this.ZERO_X_API_URL}/swap/v1/quote?${params}`, {
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
    console.log('0x quote received:', {
      buyAmount: quote.buyAmount,
      price: quote.price,
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
