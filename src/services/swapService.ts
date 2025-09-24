import { supabase } from "@/integrations/supabase/client";
import { goldPriceService } from "./goldPrice";
import { DexAggregatorService } from "./dexAggregatorService";
import { secureWalletService } from "./secureWalletService";

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
  route: {
    provider: 'aurum';
    goldPrice: number;
    timestamp: string;
  };
}

export interface SwapResult {
  success: boolean;
  transactionId?: string;
  hash?: string;
  error?: string;
  gasFeePaidInTokens?: boolean;
  gasFeeInTokens?: number;
  adjustedInputAmount?: number;
}

class SwapService {
  private readonly FEE_BPS = 150; // 1.5% total fee
  private readonly SLIPPAGE_BPS = 25; // 0.25% slippage protection
  private readonly QUOTE_VALIDITY_MINUTES = 5;

  /**
   * Generate swap quote between USDC and XAUT (Tether Gold)
   */
  async generateSwapQuote(
    inputAsset: 'USDC' | 'XAUT',
    outputAsset: 'USDC' | 'XAUT',
    inputAmount: number,
    userId: string
  ): Promise<SwapQuote> {
    try {
      // Get current gold price
      const goldPrice = await goldPriceService.getCurrentPrice();
      const goldPriceUsd = goldPrice.usd_per_gram;
      
      let outputAmount: number;
      let exchangeRate: number;

      if (inputAsset === 'USDC' && outputAsset === 'XAUT') {
        // Buying gold with USDC - need to convert to troy oz (XAUT is 1 token = 1 troy oz)
        const feeAmount = (inputAmount * this.FEE_BPS) / 10000;
        const netUsdAmount = inputAmount - feeAmount;
        const goldPricePerOz = goldPriceUsd * 31.1035; // Convert gram price to oz
        outputAmount = netUsdAmount / goldPricePerOz; // Output in troy oz
        exchangeRate = goldPricePerOz;
      } else if (inputAsset === 'XAUT' && outputAsset === 'USDC') {
        // Selling gold for USDC - XAUT input is in troy oz
        const goldPricePerOz = goldPriceUsd * 31.1035; // Convert gram price to oz
        const grossUsdAmount = inputAmount * goldPricePerOz;
        const feeAmount = (grossUsdAmount * this.FEE_BPS) / 10000;
        outputAmount = grossUsdAmount - feeAmount;
        exchangeRate = goldPricePerOz;
      } else {
        throw new Error('Invalid asset pair for swap - must swap between USDC and XAUT');
      }

      const fee = (inputAsset === 'USDC' ? inputAmount : outputAmount) * (this.FEE_BPS / 10000);
      const minimumReceived = outputAmount * (1 - this.SLIPPAGE_BPS / 10000);

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.QUOTE_VALIDITY_MINUTES);

      const quote: SwapQuote = {
        id: crypto.randomUUID(),
        inputAsset,
        outputAsset,
        inputAmount: Number(inputAmount.toFixed(6)),
        outputAmount: Number(outputAmount.toFixed(6)),
        exchangeRate: Number(exchangeRate.toFixed(2)),
        fee: Number(fee.toFixed(6)),
        minimumReceived: Number(minimumReceived.toFixed(6)),
        expiresAt: expiresAt.toISOString(),
        route: {
          provider: 'aurum',
          goldPrice: goldPriceUsd,
          timestamp: new Date(goldPrice.last_updated).toISOString()
        }
      };

      // Store quote in the quotes table (reuse existing structure)
      await this.saveSwapQuote(quote, userId);
      
      return quote;
    } catch (err) {
      console.error('Failed to generate swap quote:', err);
      throw err;
    }
  }

  /**
   * Execute swap transaction
   */
  async executeSwap(quoteId: string, userId: string): Promise<SwapResult> {
    try {
      // Get user's wallet address from secure wallet service
      const userWalletAddress = await secureWalletService.getWalletAddress(userId);
      if (!userWalletAddress) {
        return {
          success: false,
          error: 'User wallet not found. Please set up your wallet first.'
        };
      }

      // Get quote from database
      const { data: quoteData, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .eq('user_id', userId)
        .single();

      if (error || !quoteData) {
        return {
          success: false,
          error: 'Quote not found or expired'
        };
      }

      // Check if quote is still valid
      if (new Date() > new Date(quoteData.expires_at)) {
        return {
          success: false,
          error: 'Quote has expired'
        };
      }

      // Verify user has sufficient on-chain balance
      const { data: balanceData, error: balanceError } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'get_balance',
          address: userWalletAddress,
          asset: quoteData.input_asset
        }
      });

      if (balanceError || !balanceData?.success) {
        return {
          success: false,
          error: 'Failed to verify wallet balance'
        };
      }

      if (balanceData.balance < quoteData.input_amount) {
        return {
          success: false,
          error: `Insufficient ${quoteData.input_asset} balance. Required: ${quoteData.input_amount}, Available: ${balanceData.balance}`
        };
      }

      // Get optimal DEX route with user's wallet address
      const routes = await DexAggregatorService.getBestRoute(
        quoteData.input_asset,
        quoteData.output_asset,
        quoteData.input_amount,
        this.SLIPPAGE_BPS / 100,
        userWalletAddress
      );

      if (!routes || routes.length === 0) {
        return {
          success: false,
          error: 'No available swap routes found'
        };
      }

      const bestRoute = routes[0];
      
      // Execute swap through DEX aggregator with user's wallet
      const swapResult = await DexAggregatorService.executeOptimalSwap(
        bestRoute,
        userWalletAddress,
        this.SLIPPAGE_BPS / 100
      );

      if (!swapResult.success) {
        return {
          success: false,
          error: swapResult.error || 'DEX swap execution failed'
        };
      }

      // Create transaction record
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          quote_id: quoteId,
          type: 'swap',
          asset: quoteData.output_asset,
          quantity: quoteData.output_amount,
          unit_price_usd: quoteData.unit_price_usd,
          fee_usd: quoteData.input_amount * (this.FEE_BPS / 10000),
          status: 'completed',
          input_asset: quoteData.input_asset,
          output_asset: quoteData.output_asset,
          tx_hash: swapResult.txHash,
          metadata: {
            swapType: 'dex',
            protocol: bestRoute.protocol,
            route: bestRoute.route,
            priceImpact: bestRoute.priceImpact,
            gasEstimate: bestRoute.gasEstimate,
            slippage: this.SLIPPAGE_BPS,
            platformFee: this.FEE_BPS,
            gasFeePaidInTokens: swapResult.gasFeePaidInTokens || false,
            gasFeeInTokens: swapResult.gasFeeInTokens || 0,
            adjustedInputAmount: swapResult.adjustedInputAmount,
            gasPaymentMethod: swapResult.gasFeePaidInTokens ? 'tokens' : 'eth'
          }
        })
        .select()
        .single();

      if (txError) {
        console.error('Failed to create transaction record:', txError);
      }

      // NOTE: No balance snapshot updates needed since the swap happened on-chain
      // Real balances are now reflected on the blockchain and will be fetched live
      console.log('✅ REAL swap completed - balances updated on-chain');

      return {
        success: true,
        transactionId: transaction?.id,
        hash: swapResult.txHash
      };

    } catch (err) {
      console.error('Swap execution error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Swap execution failed'
      };
    }
  }

  private async saveSwapQuote(quote: SwapQuote, userId: string): Promise<void> {
    // Store in existing quotes table with swap-specific metadata
    const { error } = await supabase
      .from('quotes')
      .insert({
        id: quote.id,
        user_id: userId,
        side: 'swap',
        input_asset: quote.inputAsset,
        output_asset: quote.outputAsset,
        input_amount: quote.inputAmount,
        output_amount: quote.outputAmount,
        grams: quote.outputAsset === 'XAUT' ? quote.outputAmount * 31.1035 : quote.inputAmount / quote.route.goldPrice, // Convert oz to grams for storage
        unit_price_usd: quote.route.goldPrice,
        fee_bps: this.FEE_BPS,
        expires_at: quote.expiresAt,
        route: {
          ...quote.route,
          swapType: 'direct',
          fee: quote.fee,
          minimumReceived: quote.minimumReceived
        }
      });

    if (error) {
      console.error('Failed to save swap quote:', error);
      // Don't throw error - quote can still be used
    }
  }
}

export const swapService = new SwapService();