import { supabase } from "@/integrations/supabase/client";
import { ethers } from "ethers";

export interface BlockchainTransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
  receipt?: any;
}

export interface SwapQuote {
  id: string;
  inputAsset: 'USDC' | 'XAUT';
  outputAsset: 'USDC' | 'XAUT';
  inputAmount: number;
  outputAmount: number;
  exchangeRate: number;
  fee: number;
  minimumReceived: number;
  expiresAt: string;
}

class RealBlockchainService {
  private readonly ETHEREUM_RPC_URL = 'https://mainnet.infura.io/v3/46a2ce5cfbdf4ea6a30f5f2f8e841bf5';
  private readonly USDC_CONTRACT = '0xA0b86a33E6441b7C88047F0fE3BDD78Db8DC820C'; // USDC on Ethereum
  private readonly XAUT_CONTRACT = '0x68749665FF8D2d112Fa859AA293F07A622782F38'; // Tether Gold on Ethereum
  private readonly PLATFORM_WALLET = '0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835';
  
  // ERC20 ABI for token operations
  private readonly ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ];
  
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(this.ETHEREUM_RPC_URL);
  }

  /**
   * Execute a real blockchain transaction using Supabase Edge Function
   */
  async executeTransaction(
    operation: 'buy' | 'sell' | 'swap',
    fromAsset: 'USDC' | 'XAUT',
    toAsset: 'USDC' | 'XAUT',
    amount: number,
    userAddress: string
  ): Promise<BlockchainTransactionResult> {
    try {
      const { data, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'execute_transaction',
          fromAsset,
          toAsset,
          amount,
          userAddress,
          type: operation
        }
      });

      if (error) {
        console.error('Blockchain operation error:', error);
        return {
          success: false,
          error: error.message || 'Transaction failed'
        };
      }

      return data;
    } catch (err) {
      console.error('Transaction execution error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate swap quote between USDC and XAUT
   */
  async generateSwapQuote(
    inputAsset: 'USDC' | 'XAUT',
    outputAsset: 'USDC' | 'XAUT',
    inputAmount: number
  ): Promise<SwapQuote> {
    try {
      // Get current gold price from our gold price API
      const { data: priceData, error } = await supabase.functions.invoke('gold-price-api');
      
      if (error || !priceData) {
        throw new Error('Failed to get gold price');
      }

      const goldPriceUsd = priceData.usd_per_gram;
      const fee = 0.015; // 1.5% fee
      
      let outputAmount: number;
      let exchangeRate: number;

      if (inputAsset === 'USDC' && outputAsset === 'XAUT') {
        // Buying gold with USDC
        const netUsdAmount = inputAmount * (1 - fee);
        outputAmount = netUsdAmount / goldPriceUsd; // Convert to grams of gold
        exchangeRate = goldPriceUsd;
      } else if (inputAsset === 'XAUT' && outputAsset === 'USDC') {
        // Selling gold for USDC  
        const grossUsdAmount = inputAmount * goldPriceUsd; // inputAmount is in grams
        outputAmount = grossUsdAmount * (1 - fee);
        exchangeRate = 1 / goldPriceUsd;
      } else {
        throw new Error('Invalid asset pair for swap');
      }

      const minimumReceived = outputAmount * 0.995; // 0.5% slippage protection
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minute expiry

      const quote: SwapQuote = {
        id: crypto.randomUUID(),
        inputAsset,
        outputAsset,
        inputAmount: Number(inputAmount.toFixed(6)),
        outputAmount: Number(outputAmount.toFixed(6)),
        exchangeRate: Number(exchangeRate.toFixed(2)),
        fee: Number((inputAmount * fee).toFixed(6)),
        minimumReceived: Number(minimumReceived.toFixed(6)),
        expiresAt: expiresAt.toISOString()
      };

      // Store quote in database
      await this.saveSwapQuote(quote);
      
      return quote;
    } catch (err) {
      console.error('Failed to generate swap quote:', err);
      throw err;
    }
  }

  /**
   * Execute swap transaction
   */
  async executeSwap(
    quoteId: string,
    userAddress: string
  ): Promise<BlockchainTransactionResult> {
    try {
      // Get quote from database
      const { data: quote, error } = await supabase
        .from('swap_quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (error || !quote) {
        return {
          success: false,
          error: 'Quote not found or expired'
        };
      }

      // Check if quote is still valid
      if (new Date() > new Date(quote.expires_at)) {
        return {
          success: false,
          error: 'Quote has expired'
        };
      }

      // Execute the swap transaction
      const result = await this.executeTransaction(
        'swap',
        quote.input_asset,
        quote.output_asset,
        quote.input_amount,
        userAddress
      );

      return result;
    } catch (err) {
      console.error('Swap execution error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Swap failed'
      };
    }
  }

  /**
   * Get token balance from blockchain
   */
  async getTokenBalance(address: string, asset: 'USDC' | 'XAUT'): Promise<number> {
    try {
      const contractAddress = asset === 'USDC' ? this.USDC_CONTRACT : this.XAUT_CONTRACT;
      const contract = new ethers.Contract(contractAddress, this.ERC20_ABI, this.provider);
      
      const balanceWei = await contract.balanceOf(address);
      const decimals = await contract.decimals();
      
      return parseFloat(ethers.formatUnits(balanceWei, decimals));
    } catch (err) {
      console.error(`Failed to get ${asset} balance:`, err);
      return 0;
    }
  }

  /**
   * Monitor transaction status
   */
  async getTransactionStatus(txHash: string): Promise<{
    status: 'pending' | 'confirmed' | 'failed';
    confirmations: number;
    gasUsed?: number;
  }> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return { status: 'pending', confirmations: 0 };
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      return {
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        confirmations,
        gasUsed: Number(receipt.gasUsed)
      };
    } catch (err) {
      console.error('Failed to get transaction status:', err);
      return { status: 'failed', confirmations: 0 };
    }
  }

  private async saveSwapQuote(quote: SwapQuote): Promise<void> {
    const { error } = await supabase
      .from('swap_quotes')
      .insert({
        id: quote.id,
        input_asset: quote.inputAsset,
        output_asset: quote.outputAsset,
        input_amount: quote.inputAmount,
        output_amount: quote.outputAmount,
        exchange_rate: quote.exchangeRate,
        fee: quote.fee,
        minimum_received: quote.minimumReceived,
        expires_at: quote.expiresAt,
        user_id: (await supabase.auth.getUser()).data.user?.id
      });

    if (error) {
      console.error('Failed to save swap quote:', error);
    }
  }
}

export const realBlockchainService = new RealBlockchainService();