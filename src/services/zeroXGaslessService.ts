import { supabase } from "@/integrations/supabase/client";
import { getTokenAddress } from "@/config/tokenAddresses";

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
   * Get the appropriate chain ID based on the asset
   */
  private getChainId(asset: string): number {
    // Arbitrum for XAUT (and future Arbitrum assets)
    if (asset === 'XAUT') {
      return 42161; // Arbitrum One
    }
    // Ethereum for everything else (TRZRY, USDC, ETH)
    return 1; // Ethereum Mainnet
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
    const sellTokenAddress = getTokenAddress(sellToken);
    const buyTokenAddress = getTokenAddress(buyToken);
    const chainId = this.getChainId(sellToken);

    const params = new URLSearchParams({
      chainId: chainId.toString(),
      sellToken: sellTokenAddress,
      buyToken: buyTokenAddress,
      sellAmount: sellAmount,
      taker: userAddress,
      swapFeeRecipient: '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835',
      swapFeeBps: '80', // 0.8% platform fee
      swapFeeToken: buyToken, // Deduct fee from output
      tradeSurplusRecipient: userAddress
    });

    console.log('Fetching 0x gasless quote:', {
      sellToken,
      buyToken,
      sellAmount,
      userAddress,
      chainId
    });

    const response = await fetch(`${this.ZERO_X_API_URL}/gasless/quote?${params}`, {
      headers: {
        '0x-api-key': import.meta.env.VITE_ZERO_X_API_KEY || '',
        '0x-version': 'v2'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('0x Gasless API error:', errorText);
      throw new Error(`0x Gasless API error: ${response.statusText}`);
    }

    const quote = await response.json();
    console.log('0x gasless quote received:', {
      buyAmount: quote.buyAmount,
      price: quote.price,
      fees: quote.fees
    });

    return quote;
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
    console.log('Submitting gasless swap to 0x');

    const chainId = quote.chainId;

    const response = await fetch(`${this.ZERO_X_API_URL}/gasless/submit`, {
      method: 'POST',
      headers: {
        '0x-api-key': import.meta.env.VITE_ZERO_X_API_KEY || '',
        '0x-version': 'v2',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chainId,
        quote,
        signature,
        quoteId,
        intentId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('0x submit error:', errorText);
      throw new Error(`Failed to submit gasless swap: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Gasless swap submitted:', result);

    return result;
  }

  /**
   * Check the status of a gasless swap
   */
  async getSwapStatus(tradeHash: string): Promise<GaslessStatusResult> {
    const response = await fetch(`${this.ZERO_X_API_URL}/gasless/status/${tradeHash}`, {
      headers: {
        '0x-api-key': import.meta.env.VITE_ZERO_X_API_KEY || '',
        '0x-version': 'v2'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('0x status check error:', errorText);
      throw new Error(`Failed to check swap status: ${response.statusText}`);
    }

    const status = await response.json();
    return status;
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
