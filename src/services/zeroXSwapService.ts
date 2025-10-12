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
   * Get indicative price from 0x Swap API (no balance check)
   * Used as fallback when gasless quote fails
   */
  async getPrice(
    sellToken: string,
    buyToken: string,
    sellAmount: string
  ): Promise<{ buyAmount: string; price: string; buyTokenAddress: string; sellTokenAddress: string }> {
    const sellTokenAddress = this.getTokenAddress(sellToken);
    const buyTokenAddress = this.getTokenAddress(buyToken);

    const params = new URLSearchParams({
      sellToken: sellTokenAddress,
      buyToken: buyTokenAddress,
      sellAmount: sellAmount,
      slippagePercentage: '0.005', // 0.5% slippage
      buyTokenPercentageFee: '0.008', // 0.8% platform fee
      feeRecipient: this.PLATFORM_FEE_RECIPIENT
    });

    console.log('Fetching 0x indicative price:', {
      sellToken,
      buyToken,
      sellAmount
    });

    const response = await fetch(`${this.ZERO_X_API_URL}/swap/v1/price?${params}`, {
      headers: {
        '0x-api-key': import.meta.env.VITE_ZERO_X_API_KEY || import.meta.env.VITE_ZEROX_API_KEY || ''
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('0x price API error:', errorText);
      throw new Error(`0x price API error: ${response.statusText} - ${errorText}`);
    }

    const price = await response.json();
    console.log('0x indicative price received:', {
      buyAmount: price.buyAmount,
      price: price.price
    });

    return {
      buyAmount: price.buyAmount,
      price: price.price,
      buyTokenAddress,
      sellTokenAddress
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
      takerAddress: userAddress,
      slippagePercentage: '0.005', // 0.5% slippage (0x recommends 0.5-1%)
      buyTokenPercentageFee: '0.008', // 0.8% platform fee
      feeRecipient: this.PLATFORM_FEE_RECIPIENT,
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
        '0x-api-key': import.meta.env.VITE_ZERO_X_API_KEY || ''
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('0x API error:', errorText);
      throw new Error(`0x API error: ${response.statusText} - ${errorText}`);
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
