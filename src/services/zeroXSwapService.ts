import { supabase } from "@/integrations/supabase/client";

// Token addresses on Ethereum mainnet
const TOKEN_ADDRESSES: Record<string, string> = {
  'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native ETH representation for 0x API
  'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'XAUT': '0x68749665FF8D2d112Fa859AA293F07A622782F38',
  'TRZRY': '0x1c4C5978c94f103Ad371964A53B9f1305Bf8030B',
  'BTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' // WBTC
};

const TOKEN_DECIMALS: Record<string, number> = {
  'ETH': 18,
  'USDC': 6,
  'XAUT': 6,
  'TRZRY': 18,
  'BTC': 8
};

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
    const address = TOKEN_ADDRESSES[symbol];
    if (!address) {
      throw new Error(`Unsupported token: ${symbol}`);
    }
    return address;
  }

  getTokenDecimals(symbol: string): number {
    const decimals = TOKEN_DECIMALS[symbol];
    if (!decimals) {
      throw new Error(`Unsupported token: ${symbol}`);
    }
    return decimals;
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
