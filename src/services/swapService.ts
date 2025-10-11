import { supabase } from "@/integrations/supabase/client";
import { zeroXGaslessService, GaslessQuote } from "./zeroXGaslessService";
import { swapFeeService } from "./swapFeeService";
import { walletSigningService } from "./walletSigningService";
import { ethers } from "ethers";

export interface SwapQuote {
  id: string;
  inputAsset: string;
  outputAsset: string;
  inputAmount: number;
  outputAmount: number;
  exchangeRate: number;
  platformFee: number;
  networkFee: number;
  estimatedTotal: number;
  routeDetails: string;
  expiresAt: string;
  chainId: number;
  // Legacy properties for backward compatibility
  route?: any;
  fee?: number;
  minimumReceived?: number;
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  error?: string;
  tradeHash?: string;
  gelatoTaskId?: string;
  // Legacy properties for backward compatibility
  intentId?: string;
  requiresReconciliation?: boolean;
  hash?: string;
  requiresImport?: boolean;
}

class SwapService {
  /**
   * Generate a swap quote using 0x Gasless API
   */
  async generateSwapQuote(
    inputAsset: string,
    outputAsset: string,
    inputAmount: number,
    userId: string
  ): Promise<SwapQuote> {
    try {
      // Get user's wallet address
      const { data: onchainWallet } = await supabase
        .from('onchain_addresses')
        .select('address')
        .eq('user_id', userId)
        .single();

      if (!onchainWallet?.address) {
        throw new Error('User wallet not found');
      }

      // Convert amount to wei/smallest unit
      const decimals = this.getTokenDecimals(inputAsset);
      const sellAmount = ethers.parseUnits(inputAmount.toString(), decimals).toString();

      // Get gasless quote from 0x
      const gaslessQuote = await zeroXGaslessService.getGaslessQuote(
        inputAsset,
        outputAsset,
        sellAmount,
        onchainWallet.address
      );

      // Parse amounts
      const buyDecimals = this.getTokenDecimals(outputAsset);
      const outputAmount = parseFloat(
        ethers.formatUnits(gaslessQuote.buyAmount, buyDecimals)
      );

      // Calculate fees from 0x response
      const platformFee = gaslessQuote.fees.integratorFee?.amount 
        ? parseFloat(ethers.formatUnits(gaslessQuote.fees.integratorFee.amount, buyDecimals))
        : 0;
      
      const networkFee = gaslessQuote.fees.gasFee?.amount
        ? parseFloat(ethers.formatUnits(gaslessQuote.fees.gasFee.amount, buyDecimals))
        : 0;

      const exchangeRate = outputAmount / inputAmount;

      // Save quote to database
      const quote: SwapQuote = {
        id: crypto.randomUUID(),
        inputAsset,
        outputAsset,
        inputAmount,
        outputAmount,
        exchangeRate,
        platformFee,
        networkFee,
        estimatedTotal: outputAmount,
        routeDetails: JSON.stringify(gaslessQuote),
        expiresAt: new Date(Date.now() + 30000).toISOString(), // 30 seconds
        chainId: gaslessQuote.chainId
      };

      await this.saveSwapQuote(quote, userId);

      return quote;
    } catch (error) {
      console.error('Error generating swap quote:', error);
      throw error;
    }
  }

  /**
   * Execute a swap using 0x Gasless API
   */
  async executeSwap(
    quoteId: string,
    userId: string,
    walletPassword: string,
    useGasless: boolean = true // Always true with 0x Gasless
  ): Promise<SwapResult> {
    try {
      // ✅ PHASE 2: IDEMPOTENCY CHECK
      const { data: existingSwap } = await supabase
        .from('transactions')
        .select('id, status, metadata')
        .eq('quote_id', quoteId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSwap) {
        // If swap already in progress or completed, reject with idempotency
        if (['pending', 'completed'].includes(existingSwap.status)) {
          console.warn(`⚠️ Idempotency: Swap already exists for quote ${quoteId}`, {
            swapId: existingSwap.id,
            status: existingSwap.status
          });
          
          // Log idempotency rejection
          import('@/utils/productionMonitoring').then(({ logSwapEvent }) => {
            logSwapEvent(quoteId, userId, 'idempotency_rejected', {
              existingSwapId: existingSwap.id,
              existingStatus: existingSwap.status
            });
          });
          
          return {
            success: false,
            error: 'Swap already in progress for this quote. Please generate a new quote.'
          };
        }
      }

      // Fetch the quote
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .eq('user_id', userId)
        .single();

      if (quoteError || !quoteData) {
        throw new Error('Quote not found or expired');
      }

      // ✅ PHASE 3: QUOTE EXPIRATION MONITORING
      if (new Date() > new Date(quoteData.expires_at)) {
        console.warn(`⏱️ Quote expired: ${quoteId}`);
        
        import('@/utils/productionMonitoring').then(({ logSwapEvent }) => {
          logSwapEvent(quoteId, userId, 'swap_failed', {
            reason: 'quote_expired',
            expiresAt: quoteData.expires_at,
            attemptedAt: new Date().toISOString(),
            timeSinceExpiry: Date.now() - new Date(quoteData.expires_at).getTime()
          });
        });
        
        throw new Error('Quote has expired. Please generate a new quote.');
      }

      // Parse the stored gasless quote
      const gaslessQuote: GaslessQuote = JSON.parse(quoteData.route as string);

      // Get user wallet address
      const { data: onchainWallet } = await supabase
        .from('onchain_addresses')
        .select('address')
        .eq('user_id', userId)
        .single();

      if (!onchainWallet?.address) {
        throw new Error('Wallet not found');
      }

      // Create transaction record
      const intentId = crypto.randomUUID();

      try {
        // Sign the trade permit with user's wallet
        let signature: string = '';
        
        if (gaslessQuote.approval) {
          // Sign approval permit if needed
          signature = await walletSigningService.signTypedData(
            userId,
            walletPassword,
            gaslessQuote.chainId,
            gaslessQuote.approval.eip712.domain,
            gaslessQuote.approval.eip712.types,
            gaslessQuote.approval.eip712.message
          );
        }
        
        if (gaslessQuote.trade) {
          // Sign trade permit
          signature = await walletSigningService.signTypedData(
            userId,
            walletPassword,
            gaslessQuote.chainId,
            gaslessQuote.trade.eip712.domain,
            gaslessQuote.trade.eip712.types,
            gaslessQuote.trade.eip712.message
          );
        }

        if (!signature) {
          throw new Error('No signature generated - quote may not require permits');
        }

        // Submit to 0x gasless endpoint
        const submitResult = await zeroXGaslessService.submitGaslessSwap(
          gaslessQuote,
          signature,
          quoteId,
          intentId
        );

        // Wait for completion (with timeout)
        const statusResult = await zeroXGaslessService.waitForCompletion(
          submitResult.tradeHash,
          60, // 60 attempts
          2000 // 2 seconds interval
        );

        if (statusResult.status === 'confirmed' && statusResult.transactions.length > 0) {
          const txHash = statusResult.transactions[0].hash;

          // Record transaction with proper schema + idempotency metadata
          const idempotencyKey = `swap_${quoteId}_${Date.now()}`;
          
          const { error: txError } = await supabase
            .from('transactions')
            .insert({
              user_id: userId,
              quote_id: quoteId, // ✅ Link to quote for idempotency
              asset: quoteData.output_asset, // Asset received
              type: 'swap',
              status: 'completed',
              quantity: quoteData.output_amount, // Output amount
              unit_price_usd: quoteData.unit_price_usd || 0,
              fee_usd: quoteData.fee_bps || 80,
              transaction_hash: txHash,
              input_asset: quoteData.input_asset,
              output_asset: quoteData.output_asset,
              metadata: {
                chainId: gaslessQuote.chainId,
                tradeHash: submitResult.tradeHash,
                gasless: true,
                quoteId,
                idempotency_key: idempotencyKey, // ✅ Track idempotency
                submission_timestamp: Date.now(),
                quote_used: quoteId
              },
              created_at: new Date().toISOString()
            });

          // Record fee collection with proper transaction ID
          const feeCalculation = swapFeeService.calculateSwapFee(
            quoteData.input_amount,
            quoteData.input_asset as any,
            quoteData.output_asset as any
          );

          // Note: Fee recording uses the txHash as the transaction reference
          await swapFeeService.recordSwapFeeCollection(userId, txHash, feeCalculation);

          return {
            success: true,
            txHash,
            tradeHash: submitResult.tradeHash,
            intentId,
            hash: txHash
          };
        } else {
          throw new Error(`Swap failed with status: ${statusResult.status}`);
        }
      } catch (error) {
        console.error('Swap execution error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Swap execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Swap execution failed'
      };
    }
  }

  private async saveSwapQuote(quote: SwapQuote, userId: string) {
    const { error } = await supabase.from('quotes').insert({
      user_id: userId,
      side: 'buy',
      input_asset: quote.inputAsset,
      output_asset: quote.outputAsset,
      input_amount: quote.inputAmount,
      output_amount: quote.outputAmount,
      unit_price_usd: quote.exchangeRate,
      fee_bps: 80,
      grams: 0,
      route: quote.routeDetails as any,
      expires_at: quote.expiresAt,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error('Error saving quote:', error);
      throw new Error('Failed to save quote');
    }
  }

  private getTokenDecimals(symbol: string): number {
    const decimals: Record<string, number> = {
      'ETH': 18,
      'USDC': 6,
      'XAUT': 6,
      'TRZRY': 18,
      'BTC': 8
    };
    return decimals[symbol] || 18;
  }
}

export const swapService = new SwapService();
