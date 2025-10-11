import { supabase } from "@/integrations/supabase/client";
import { goldPriceService } from "./goldPrice";
import { DexAggregatorService } from "./dexAggregatorService";
import { secureWalletService } from "./secureWalletService";
import { swapFeeService } from "./swapFeeService";
import { safeSwapService } from "./safeSwapService";
import { zeroXSwapService } from "./zeroXSwapService";
import { ethers } from "ethers";

export interface SwapQuote {
  id: string;
  inputAsset: 'ETH' | 'USDC' | 'XAUT' | 'TRZRY' | 'BTC';
  outputAsset: 'ETH' | 'USDC' | 'XAUT' | 'TRZRY' | 'BTC';
  inputAmount: number;
  outputAmount: number;
  exchangeRate: number;
  fee: number;
  minimumReceived: number;
  expiresAt: string;
  route: {
    provider: 'aurum' | 'dex' | '0x';
    goldPrice?: number;
    trzryPrice?: number;
    timestamp: string;
    zeroXQuote?: any;
    sources?: Array<{ name: string; proportion: string }>;
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
  approvalStatus?: string; // 'new' | 'existing' | 'not_required'
}

class SwapService {
  private readonly FEE_BPS = 80; // 0.8% total fee
  private readonly PLATFORM_FEE_BPS = 80; // 0.8% platform fee (same as total fee)
  private readonly SLIPPAGE_BPS = 25; // 0.25% slippage protection
  private readonly QUOTE_VALIDITY_MINUTES = 10; // 10 minutes for user review

  /**
   * Generate swap quote between supported assets using 0x
   */
  async generateSwapQuote(
    inputAsset: 'ETH' | 'USDC' | 'XAUT' | 'TRZRY' | 'BTC',
    outputAsset: 'ETH' | 'USDC' | 'XAUT' | 'TRZRY' | 'BTC',
    inputAmount: number,
    userId: string
  ): Promise<SwapQuote> {
    try {
      // Validate supported pairs
      if (inputAsset === outputAsset) {
        throw new Error('Input and output assets cannot be the same');
      }
      
      const supportedPairs = [
        ['ETH', 'USDC'], ['USDC', 'ETH'],
        ['ETH', 'XAUT'], ['XAUT', 'ETH'],
        ['ETH', 'TRZRY'], ['TRZRY', 'ETH'],
        ['USDC', 'XAUT'], ['XAUT', 'USDC'],
        ['USDC', 'TRZRY'], ['TRZRY', 'USDC'],
        ['XAUT', 'TRZRY'], ['TRZRY', 'XAUT'],
        ['BTC', 'ETH'], ['ETH', 'BTC'],
        ['BTC', 'USDC'], ['USDC', 'BTC'],
        ['BTC', 'XAUT'], ['XAUT', 'BTC'],
        ['BTC', 'TRZRY'], ['TRZRY', 'BTC']
      ];
      
      const pairExists = supportedPairs.some(([asset1, asset2]) => 
        (inputAsset === asset1 && outputAsset === asset2)
      );
      
      if (!pairExists) {
        throw new Error('Swap pair not supported');
      }

      // Get user wallet address for 0x quote
      const userWalletAddress = await secureWalletService.getWalletAddress(userId);
      if (!userWalletAddress) {
        throw new Error('User wallet not found');
      }

      // Use 0x for all swaps - provides best pricing across 100+ DEXs
      console.log('[SwapService] Getting 0x quote for swap:', { inputAsset, outputAsset, inputAmount });

      const inputDecimals = zeroXSwapService.getTokenDecimals(inputAsset);
      const outputDecimals = zeroXSwapService.getTokenDecimals(outputAsset);
      const sellAmount = ethers.parseUnits(inputAmount.toString(), inputDecimals).toString();

      const zeroXQuote = await zeroXSwapService.getQuote(
        inputAsset,
        outputAsset,
        sellAmount,
        userWalletAddress
      );

      const outputAmount = parseFloat(ethers.formatUnits(zeroXQuote.buyAmount, outputDecimals));
      const exchangeRate = outputAmount / inputAmount;

      console.log('[SwapService] 0x quote received:', {
        outputAmount,
        exchangeRate,
        sources: zeroXQuote.sources
      });

      // Calculate fee (0.8% already included in 0x quote via buyTokenPercentageFee)
      const fee = inputAmount * (this.FEE_BPS / 10000);

      // 0x guaranteedPrice already includes slippage protection
      const minimumReceived = parseFloat(ethers.formatUnits(zeroXQuote.guaranteedPrice, outputDecimals)) * inputAmount;

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
          provider: '0x',
          timestamp: new Date().toISOString(),
          zeroXQuote,
          sources: zeroXQuote.sources
        }
      };

      // Store quote in the quotes table
      await this.saveSwapQuote(quote, userId);
      
      return quote;
    } catch (err) {
      console.error('Failed to generate swap quote:', err);
      throw err;
    }
  }

  /**
   * Execute swap transaction
   * @param useGasless Enable Gelato gasless swap (no ETH needed)
   */
  async executeSwap(
    quoteId: string, 
    userId: string, 
    walletPassword: string,
    useGasless: boolean = false
  ): Promise<SwapResult> {
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

      // Calculate platform fee from input token
      const feeCalc = swapFeeService.calculateSwapFee(
        quoteData.input_amount,
        quoteData.input_asset as any,
        quoteData.output_asset as any
      );
      console.log(`[SwapService] Platform fee: ${feeCalc.feeAmount} ${feeCalc.feeAsset}, Net input: ${feeCalc.remainingAmount}`);

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

      // Get 0x quote from saved quote data
      const route = quoteData.route as any;
      const zeroXQuote = route?.zeroXQuote;
      if (!zeroXQuote) {
        console.error('[SwapService] Missing 0x quote data');
        await safeSwapService.updateIntentStatus(intentId, 'validation_failed', {
          error_message: 'Missing 0x quote data',
          error_details: { reason: 'invalid_quote' }
        });
        return {
          success: false,
          error: 'Invalid quote data. Please generate a new quote.'
        };
      }

      // Execute swap - choose gasless or traditional
      if (useGasless) {
        console.log('[SwapService] ⚡ Executing GASLESS swap via Gelato...');
        const { gelatoSwapService } = await import('./gelatoSwapService');
        
        const gelatoResult = await gelatoSwapService.executeGaslessSwap(
          zeroXQuote,
          quoteData.input_asset,
          quoteData.output_asset,
          userWalletAddress,
          quoteId,
          intentId,
          'syncfee' // User pays fee from output tokens
        );

        if (!gelatoResult.success) {
          console.error('[SwapService] Gelato swap failed:', gelatoResult.error);
          return {
            success: false,
            error: gelatoResult.error || 'Gasless swap failed',
            intentId
          };
        }

        console.log('[SwapService] ✅ Gelato gasless swap successful');
        return {
          success: true,
          transactionId: gelatoResult.txHash,
          hash: gelatoResult.txHash,
          intentId,
          gasFeePaidInTokens: true
        };
      } else {
        // Traditional swap - user pays gas in ETH
        console.log('[SwapService] Executing traditional swap via 0x...');
        const swapResult = await zeroXSwapService.executeSwap(
          zeroXQuote,
          quoteData.input_asset,
          quoteData.output_asset,
          userWalletAddress,
          walletPassword,
          quoteId,
          intentId
        );

        if (!swapResult.success) {
          console.error('[SwapService] 0x swap execution failed:', swapResult.error);
          return {
            success: false,
            error: swapResult.error || 'Swap execution failed',
            intentId
          };
        }

        console.log('[SwapService] ✅ 0x swap executed successfully');
        return {
          success: true,
          transactionId: swapResult.txHash,
          hash: swapResult.txHash,
          intentId
        };
      }
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