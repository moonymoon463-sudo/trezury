import { supabase } from "@/integrations/supabase/client";
import { goldPriceService } from "./goldPrice";
import { DexAggregatorService } from "./dexAggregatorService";
import { secureWalletService } from "./secureWalletService";
import { swapFeeService } from "./swapFeeService";

export interface SwapQuote {
  id: string;
  inputAsset: 'USDC' | 'XAUT' | 'TRZRY';
  outputAsset: 'USDC' | 'XAUT' | 'TRZRY';
  inputAmount: number;
  outputAmount: number;
  exchangeRate: number;
  fee: number;
  minimumReceived: number;
  expiresAt: string;
  route: {
    provider: 'aurum' | 'dex';
    goldPrice?: number;
    trzryPrice?: number;
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
  private readonly FEE_BPS = 80; // 0.8% total fee
  private readonly SLIPPAGE_BPS = 25; // 0.25% slippage protection
  private readonly QUOTE_VALIDITY_MINUTES = 10; // 10 minutes for user review

  /**
   * Generate swap quote between supported assets
   */
  async generateSwapQuote(
    inputAsset: 'USDC' | 'XAUT' | 'TRZRY',
    outputAsset: 'USDC' | 'XAUT' | 'TRZRY',
    inputAmount: number,
    userId: string
  ): Promise<SwapQuote> {
    try {
      // Validate supported pairs
      if (inputAsset === outputAsset) {
        throw new Error('Input and output assets cannot be the same');
      }
      
      const supportedPairs = [
        ['USDC', 'XAUT'], ['XAUT', 'USDC'],
        ['USDC', 'TRZRY'], ['TRZRY', 'USDC']
      ];
      
      const pairExists = supportedPairs.some(([asset1, asset2]) => 
        (inputAsset === asset1 && outputAsset === asset2)
      );
      
      if (!pairExists) {
        throw new Error('Only USDC ⟷ XAUT and USDC ⟷ TRZRY swaps are currently supported');
      }

      let outputAmount: number;
      let exchangeRate: number;
      let provider: 'aurum' | 'dex' = 'aurum';
      let priceSource: any = {};

      if ((inputAsset === 'USDC' && outputAsset === 'XAUT') || (inputAsset === 'XAUT' && outputAsset === 'USDC')) {
        // Gold swaps - use existing gold price logic
        const goldPrice = await goldPriceService.getCurrentPrice();
        const goldPriceUsd = goldPrice.usd_per_gram;
        priceSource.goldPrice = goldPriceUsd;
        priceSource.timestamp = new Date(goldPrice.last_updated).toISOString();

        if (inputAsset === 'USDC' && outputAsset === 'XAUT') {
          // Buying gold with USDC
          const feeAmount = (inputAmount * this.FEE_BPS) / 10000;
          const netUsdAmount = inputAmount - feeAmount;
          const goldPricePerOz = goldPriceUsd * 31.1035;
          outputAmount = netUsdAmount / goldPricePerOz;
          exchangeRate = goldPricePerOz;
        } else {
          // Selling gold for USDC
          const goldPricePerOz = goldPriceUsd * 31.1035;
          const grossUsdAmount = inputAmount * goldPricePerOz;
          const feeAmount = (grossUsdAmount * this.FEE_BPS) / 10000;
          outputAmount = grossUsdAmount - feeAmount;
          exchangeRate = goldPricePerOz;
        }
      } else if ((inputAsset === 'USDC' && outputAsset === 'TRZRY') || (inputAsset === 'TRZRY' && outputAsset === 'USDC')) {
        // TRZRY swaps - use fixed rate for now (1:1 with USDC)
        provider = 'dex';
        const trzryPrice = 1.0; // Fixed rate for demo
        priceSource.trzryPrice = trzryPrice;
        priceSource.timestamp = new Date().toISOString();

        if (inputAsset === 'USDC' && outputAsset === 'TRZRY') {
          const feeAmount = (inputAmount * this.FEE_BPS) / 10000;
          const netUsdAmount = inputAmount - feeAmount;
          outputAmount = netUsdAmount / trzryPrice;
          exchangeRate = trzryPrice;
        } else {
          const grossUsdAmount = inputAmount * trzryPrice;
          const feeAmount = (grossUsdAmount * this.FEE_BPS) / 10000;
          outputAmount = grossUsdAmount - feeAmount;
          exchangeRate = trzryPrice;
        }
      } else {
        throw new Error('Unsupported asset pair');
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
        exchangeRate: Number(exchangeRate.toFixed(6)),
        fee: Number(fee.toFixed(6)),
        minimumReceived: Number(minimumReceived.toFixed(6)),
        expiresAt: expiresAt.toISOString(),
        route: {
          provider,
          ...priceSource
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
      console.log(`[SwapService] Starting swap execution for quote: ${quoteId}, user: ${userId}`);
      
      // Get user's wallet address from secure wallet service
      const userWalletAddress = await secureWalletService.getWalletAddress(userId);
      if (!userWalletAddress) {
        console.error('[SwapService] User wallet not found');
        return {
          success: false,
          error: 'User wallet not found. Please set up your wallet first.'
        };
      }

      console.log(`[SwapService] Retrieved user wallet: ${userWalletAddress}`);

      // Get quote from database with detailed logging
      console.log(`[SwapService] Fetching quote from database...`);
      const { data: quoteData, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .eq('user_id', userId)
        .maybeSingle();

      console.log(`[SwapService] Quote query result:`, { 
        found: !!quoteData, 
        error: error?.message,
        quoteId,
        userId 
      });

      if (error) {
        console.error('[SwapService] Database error fetching quote:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`
        };
      }

      if (!quoteData) {
        console.error('[SwapService] Quote not found in database');
        return {
          success: false,
          error: 'Quote not found. It may have been deleted or never saved properly.'
        };
      }

      console.log(`[SwapService] Quote found, checking expiration...`);

      // Check if quote is still valid
      const now = new Date();
      const expiresAt = new Date(quoteData.expires_at);
      if (now > expiresAt) {
        const expiredMinutesAgo = Math.floor((now.getTime() - expiresAt.getTime()) / 60000);
        console.error(`[SwapService] Quote expired ${expiredMinutesAgo} minutes ago`);
        return {
          success: false,
          error: `Quote expired ${expiredMinutesAgo} minutes ago. Please generate a new quote.`
        };
      }

      console.log(`[SwapService] Quote is valid, checking balance...`);

      // Verify user has sufficient on-chain balance
      const { data: balanceData, error: balanceError } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'get_balance',
          address: userWalletAddress,
          asset: quoteData.input_asset
        }
      });

      if (balanceError || !balanceData?.success) {
        console.error('[SwapService] Failed to verify balance:', balanceError);
        return {
          success: false,
          error: 'Failed to verify wallet balance'
        };
      }

      console.log(`[SwapService] Balance check: ${balanceData.balance} ${quoteData.input_asset} available`);

      if (balanceData.balance < quoteData.input_amount) {
        console.error('[SwapService] Insufficient balance');
        return {
          success: false,
          error: `Insufficient ${quoteData.input_asset} balance. Required: ${quoteData.input_amount}, Available: ${balanceData.balance}`
        };
      }

      // Get optimal DEX route with user's wallet address
      console.log(`[SwapService] Finding best DEX route...`);
      const routes = await DexAggregatorService.getBestRoute(
        quoteData.input_asset,
        quoteData.output_asset,
        quoteData.input_amount,
        this.SLIPPAGE_BPS / 100,
        userWalletAddress
      );

      if (!routes || routes.length === 0) {
        console.error('[SwapService] No swap routes available');
        return {
          success: false,
          error: 'No available swap routes found'
        };
      }

      const bestRoute = routes[0];
      console.log(`[SwapService] Best route selected: ${bestRoute.protocol}`);
      
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

      // Calculate and record swap fee
      const feeCalculation = swapFeeService.calculateSwapFee(
        quoteData.output_amount,
        quoteData.output_asset as 'USDC' | 'GOLD',
        quoteData.input_asset as 'USDC' | 'GOLD'
      );

      // Record fee collection for tracking
      if (transaction?.id) {
        await swapFeeService.recordSwapFeeCollection(
          userId,
          transaction.id,
          feeCalculation
        );
      }

      // NOTE: No balance snapshot updates needed since the swap happened on-chain
      // Real balances are now reflected on the blockchain and will be fetched live
      console.log('✅ REAL swap completed - balances updated on-chain');
      console.log(`💰 Platform fee collected: ${feeCalculation.feeAmount} ${feeCalculation.feeAsset}`);

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
        grams: quote.outputAsset === 'XAUT' ? quote.outputAmount * 31.1035 : 
               quote.inputAsset === 'XAUT' ? quote.inputAmount * 31.1035 : 0,
        unit_price_usd: quote.route.goldPrice || quote.route.trzryPrice || 1,
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
      console.error('Failed to save swap quote to database:', error);
      throw new Error(`Failed to save quote: ${error.message}`);
    }
  }
}

export const swapService = new SwapService();