import { supabase } from "@/integrations/supabase/client";
import { goldPriceService } from "./goldPrice";
import { DexAggregatorService } from "./dexAggregatorService";
import { secureWalletService } from "./secureWalletService";
import { swapFeeService } from "./swapFeeService";
import { safeSwapService } from "./safeSwapService";

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
  intentId?: string;
  hash?: string;
  error?: string;
  gasFeePaidInTokens?: boolean;
  gasFeeInTokens?: number;
  adjustedInputAmount?: number;
  requiresImport?: boolean; // Indicates user needs to import wallet key
  requiresReconciliation?: boolean; // Indicates on-chain success but DB record failed
  requiresRefund?: boolean; // Indicates swap failed but refund succeeded
  refundTxHash?: string;
  relayFeeUsd?: string;
  netOutputAmount?: string;
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
        ['USDC', 'TRZRY'], ['TRZRY', 'USDC'],
        ['XAUT', 'TRZRY'], ['TRZRY', 'XAUT']
      ];
      
      const pairExists = supportedPairs.some(([asset1, asset2]) => 
        (inputAsset === asset1 && outputAsset === asset2)
      );
      
      if (!pairExists) {
        throw new Error('Only USDC ⟷ XAUT, USDC ⟷ TRZRY, and XAUT ⟷ TRZRY swaps are supported');
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
        // TRZRY swaps - use live market price from Uniswap V3
        provider = 'dex';
        const trzryPrice = await this.getTRZRYPrice();
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
      } else if ((inputAsset === 'XAUT' && outputAsset === 'TRZRY') || (inputAsset === 'TRZRY' && outputAsset === 'XAUT')) {
        // XAUT ↔ TRZRY direct swap
        provider = 'dex';
        
        // Get live TRZRY price from Uniswap V3
        const trzryPriceInUSDC = await this.getTRZRYPrice();
        
        // Get live XAUT price (gold price)
        const goldPrice = await goldPriceService.getCurrentPrice();
        const xautPriceInUSDC = goldPrice.usd_per_gram * 31.1035; // per oz
        
        priceSource.trzryPrice = trzryPriceInUSDC;
        priceSource.xautPrice = xautPriceInUSDC;
        priceSource.timestamp = new Date().toISOString();
        
        if (inputAsset === 'XAUT' && outputAsset === 'TRZRY') {
          // XAUT → TRZRY: Calculate via USDC equivalent
          const usdcValue = inputAmount * xautPriceInUSDC;
          const feeAmount = (usdcValue * this.FEE_BPS) / 10000;
          const netUsdcValue = usdcValue - feeAmount;
          outputAmount = netUsdcValue / trzryPriceInUSDC;
          exchangeRate = xautPriceInUSDC / trzryPriceInUSDC;
        } else {
          // TRZRY → XAUT: Calculate via USDC equivalent
          const usdcValue = inputAmount * trzryPriceInUSDC;
          const feeAmount = (usdcValue * this.FEE_BPS) / 10000;
          const netUsdcValue = usdcValue - feeAmount;
          outputAmount = netUsdcValue / xautPriceInUSDC;
          exchangeRate = trzryPriceInUSDC / xautPriceInUSDC;
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
  async executeSwap(quoteId: string, userId: string, walletPassword: string): Promise<SwapResult> {
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

      console.log(`[SwapService] Quote is valid, proceeding with swap...`);

      // Balance check is performed in blockchain-operations edge function
      // No need to check twice - reduces latency and complexity
      
      // 🔒 STATE MACHINE VALIDATION: Check for existing pending intents with same quote
      console.log('[SwapService] Checking for existing pending intents...');
      const { data: existingIntents } = await supabase
        .from('transaction_intents')
        .select('id, status, created_at')
        .eq('quote_id', quoteId)
        .in('status', ['pending', 'validating', 'funds_pulled', 'swap_executed'])
        .order('created_at', { ascending: false });
      
      if (existingIntents && existingIntents.length > 0) {
        const latestIntent = existingIntents[0];
        const ageMinutes = Math.floor((Date.now() - new Date(latestIntent.created_at).getTime()) / 60000);
        
        console.warn(`[SwapService] Found existing ${latestIntent.status} intent: ${latestIntent.id} (${ageMinutes}m old)`);
        
        // Different timeout thresholds based on status
        const isStuckValidating = latestIntent.status === 'validating' && ageMinutes >= 2;
        const isStuckOther = latestIntent.status !== 'validating' && ageMinutes >= 10;
        
        // If intent is actively progressing (not stuck), reject duplicate
        if (!isStuckValidating && !isStuckOther) {
          return {
            success: false,
            error: `A swap for this quote is already in progress (${latestIntent.status}). Please wait or generate a new quote.`
          };
        }
        
        // If intent is stuck, fail it before creating new one
        console.log(`[SwapService] Canceling stuck ${latestIntent.status} intent (${ageMinutes}m old) before creating new one...`);
        await safeSwapService.updateIntentStatus(latestIntent.id, 'failed', {
          error_message: `Stuck in ${latestIntent.status} for ${ageMinutes} minutes - superseded by new swap attempt`,
          error_details: { reason: 'state_machine_cleanup', age_minutes: ageMinutes }
        });
      }
      
      // 🔒 SAFETY: Create transaction intent BEFORE any blockchain interaction
      console.log('[SwapService] Creating swap intent for safety tracking...');
      const intentResult = await safeSwapService.createSwapIntent(
        quoteId,
        userId,
        quoteData.input_asset,
        quoteData.output_asset,
        quoteData.input_amount,
        quoteData.output_amount
      );

      if (!intentResult) {
        console.error('[SwapService] ❌ Failed to create swap intent');
        return {
          success: false,
          error: 'Failed to initialize swap tracking. Please try again.'
        };
      }

      const { intentId, idempotencyKey } = intentResult;
      console.log(`[SwapService] 🔒 Intent created: ${intentId}`);

      // Pass idempotency key to blockchain operations for server-side duplicate prevention
      console.log(`[SwapService] Using idempotency key: ${idempotencyKey}`);
      
      // Update intent to validating status
      await safeSwapService.updateIntentStatus(intentId, 'validating', {
        validation_data: {
          balance_checked: true,
          quote_valid: true,
          wallet_ready: true
        }
      });

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
        await safeSwapService.updateIntentStatus(intentId, 'validation_failed', {
          error_message: 'No trading routes available',
          error_details: { reason: 'no_routes_found' }
        });
        return {
          success: false,
          error: 'No available swap routes found'
        };
      }

      const bestRoute = routes[0];
      console.log(`[SwapService] Best route selected: ${bestRoute.protocol}`);
      
      // Execute swap through DEX aggregator with intent tracking and idempotency
      const swapResult = await DexAggregatorService.executeOptimalSwap(
        bestRoute,
        userWalletAddress,
        this.SLIPPAGE_BPS / 100,
        walletPassword,
        quoteId,
        intentId, // Pass actual intent row ID
        idempotencyKey // Pass idempotency key for duplicate detection
      );

      if (!swapResult.success) {
        console.error('[SwapService] Swap execution failed:', swapResult.error);
        // Intent status already updated by blockchain-operations
        return {
          success: false,
          error: swapResult.error || 'DEX swap execution failed',
          requiresImport: swapResult.requiresImport,
          requiresReconciliation: swapResult.requiresReconciliation,
          requiresRefund: swapResult.requiresRefund,
          refundTxHash: swapResult.refundTxHash,
          hash: swapResult.txHash,
          intentId
        };
      }
      
      console.log('[SwapService] ✅ Swap executed successfully');
      
      // If reconciliation is required, return immediately (on-chain swap succeeded but DB write failed)
      if (swapResult.requiresReconciliation) {
        console.log('[SwapService] Swap succeeded on-chain but requires reconciliation');
        return {
          success: true,
          requiresReconciliation: true,
          hash: swapResult.txHash,
          intentId,
          transactionId: null // No DB record yet
        };
      }

      // Intent status already updated to 'completed' by blockchain-operations
      return {
        success: true,
        transactionId: swapResult.transactionId,
        hash: swapResult.txHash,
        intentId,
        netOutputAmount: swapResult.netOutputAmount,
        relayFeeUsd: swapResult.relayFeeUsd
      };

      // Create transaction record with retry logic
      const netOutput = swapResult.netOutputAmount 
        ? parseFloat(swapResult.netOutputAmount) 
        : quoteData.output_amount;
      
      let transaction = null;
      let retryCount = 0;
      const MAX_RETRIES = 3;
      let dbRecordSuccess = false;

      while (retryCount < MAX_RETRIES) {
        try {
          const { data, error } = await supabase
            .from('transactions')
            .insert({
              user_id: userId,
              quote_id: quoteId,
              type: 'swap',
              asset: quoteData.output_asset,
              quantity: netOutput,
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
                gasPaymentMethod: swapResult.gasFeePaidInTokens ? 'tokens' : 'eth',
                gasFeePaidByRelayer: swapResult.gasFeePaidByRelayer || false,
                relayFeeInOutputTokens: swapResult.relayFeeInOutputTokens || '0',
                relayFeeUsd: swapResult.relayFeeUsd || '0',
                netOutputReceived: swapResult.netOutputAmount || swapResult.outputAmount,
                relayerAddress: swapResult.relayerAddress || null
              }
            })
            .select()
            .single();
          
          if (error) throw error;
          if (!data) throw new Error('Transaction insert returned no data');
          
          transaction = data;
          dbRecordSuccess = true;
          console.log('✅ Transaction record created successfully');
          break; // Success!
          
        } catch (err) {
          retryCount++;
          console.error(`⚠️ Transaction record attempt ${retryCount}/${MAX_RETRIES} failed:`, err);
          
          if (retryCount >= MAX_RETRIES) {
            // CRITICAL: Log for manual reconciliation
            console.error('🚨 CRITICAL: On-chain swap succeeded but DB record failed', {
              txHash: swapResult.txHash,
              userId,
              quoteId,
              inputAsset: quoteData.input_asset,
              outputAsset: quoteData.output_asset,
              inputAmount: quoteData.input_amount,
              outputAmount: netOutput,
              error: err instanceof Error ? err.message : String(err)
            });
            
            // Store failed transaction for reconciliation
            await supabase.from('failed_transaction_records').insert({
              user_id: userId,
              tx_hash: swapResult.txHash,
              quote_id: quoteId,
              swap_data: {
                inputAsset: quoteData.input_asset,
                outputAsset: quoteData.output_asset,
                inputAmount: quoteData.input_amount,
                outputAmount: netOutput,
                exchangeRate: quoteData.unit_price_usd,
                protocol: bestRoute.protocol,
                swapResult
              },
              error_message: err instanceof Error ? err.message : String(err)
            });
            
            // Return with reconciliation flag
            return {
              success: false,
              error: 'Swap completed on blockchain but failed to record. Your balance will update shortly.',
              hash: swapResult.txHash,
              requiresReconciliation: true
            };
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        }
      }

      // Calculate and record swap fee
      const feeCalculation = swapFeeService.calculateSwapFee(
        quoteData.output_amount,
        quoteData.output_asset as 'USDC' | 'XAUT',
        quoteData.input_asset as 'USDC' | 'XAUT'
      );

      // Record fee collection for tracking
      let feeCollectionSuccess = false;
      if (transaction?.id) {
        const feeResult = await swapFeeService.recordSwapFeeCollection(
          userId,
          transaction.id,
          feeCalculation
        );
        feeCollectionSuccess = feeResult.success;
      }

      // Record metrics for monitoring
      await supabase.from('swap_execution_metrics').insert({
        on_chain_success: true,
        db_record_success: dbRecordSuccess,
        fee_collection_success: feeCollectionSuccess,
        retry_count: retryCount,
        user_id: userId,
        metadata: {
          txHash: swapResult.txHash,
          inputAsset: quoteData.input_asset,
          outputAsset: quoteData.output_asset
        }
      });

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

  /**
   * Get live TRZRY price from Uniswap V3
   */
  private async getTRZRYPrice(): Promise<number> {
    try {
      // Query Uniswap V3 for TRZRY/USDC price
      const { data, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'get_uniswap_quote',
          inputAsset: 'TRZRY',
          outputAsset: 'USDC',
          amount: 1.0, // Query price of 1 TRZRY
          slippage: 0.1
        }
      });

      if (error || !data?.success) {
        console.warn('⚠️ Failed to fetch live TRZRY price, using fallback 1.0');
        return 1.0; // Fallback to 1:1 if pool doesn't exist yet
      }

      return data.outputAmount; // Live TRZRY price in USDC
    } catch (error) {
      console.error('❌ Error fetching TRZRY price:', error);
      return 1.0; // Fallback
    }
  }

  private async saveSwapQuote(quote: SwapQuote, userId: string): Promise<void> {
    // Store in existing quotes table with swap-specific metadata
    const { error } = await supabase
      .from('quotes')
      .insert({
        id: quote.id,
        user_id: userId,
        side: 'SWAP',
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