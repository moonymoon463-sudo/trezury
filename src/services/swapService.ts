import { supabase } from "@/integrations/supabase/client";
import { zeroXGaslessService, GaslessQuote } from "./zeroXGaslessService";
import { zeroXSwapService } from "./zeroXSwapService";
import { swapFeeService } from "./swapFeeService";
import { walletSigningService } from "./walletSigningService";
import { getTokenDecimals, getTokenChainId } from "@/config/tokenAddresses";
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
      const decimals = getTokenDecimals(inputAsset);
      const sellAmount = ethers.parseUnits(inputAmount.toString(), decimals).toString();

      // Try gasless quote first, fallback to indicative price or Camelot V3 if it fails
      let gaslessQuote: GaslessQuote | null = null;
      const chainId = getTokenChainId(inputAsset);
      
      try {
        gaslessQuote = await zeroXGaslessService.getGaslessQuote(
          inputAsset,
          outputAsset,
          sellAmount,
          onchainWallet.address
        );
      } catch (error: any) {
        console.log('Gasless quote failed, checking fallback options:', error);
        
        // Check if we should try Camelot V3 (Arbitrum USDC/XAUT pairs)
        const shouldTryCamelot = 
          chainId === 42161 && 
          ((inputAsset === 'USDC_ARB' && outputAsset === 'XAUT_ARB') ||
           (inputAsset === 'XAUT_ARB' && outputAsset === 'USDC_ARB'));

        
        if (shouldTryCamelot) {
          console.log('🟢 Trying Camelot fallback', {
            inputAsset,
            outputAsset,
            sellAmount,
            chainId
          });
          
          try {
            // Import Camelot service
            const { camelotV3Service } = await import('./camelotV3Service');
            
            // Get token addresses
            const { getTokenAddress } = await import('@/config/tokenAddresses');
            const tokenInAddress = getTokenAddress(inputAsset);
            const tokenOutAddress = getTokenAddress(outputAsset);
            
            console.log('🔗 Camelot token addresses', { tokenInAddress, tokenOutAddress });
            
            // Get quote from Camelot V3
            const camelotQuote = await camelotV3Service.getQuote(
              tokenInAddress,
              tokenOutAddress,
              sellAmount
            );
            
            console.log('🟢 Camelot V3 quote received:', camelotQuote);
            
            const buyDecimals = getTokenDecimals(outputAsset);
            
            // Robust amountOut parsing: prefer raw string, fallback to formatted number
            const rawAmountOut = camelotQuote.amountOut ?? camelotQuote.amountOutFormatted;
            if (!rawAmountOut && rawAmountOut !== 0) {
              console.error('❌ Camelot quote missing amountOut/amountOutFormatted', camelotQuote);
              throw new Error('Camelot quote returned no amountOut');
            }
            
            let outputAmount: number;
            if (typeof rawAmountOut === 'string') {
              // Base units -> formatted
              outputAmount = parseFloat(ethers.formatUnits(rawAmountOut, buyDecimals));
            } else {
              // Already formatted number
              outputAmount = rawAmountOut as number;
            }
            
            console.log('💰 Parsed Camelot outputAmount:', { outputAmount, buyDecimals });
            
            const exchangeRate = outputAmount / inputAmount;
            
            // Platform fee: 0.8%
            const platformFee = outputAmount * 0.008;
            const networkFee = 0; // Gelato will deduct from output
            
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
              routeDetails: JSON.stringify({ 
                indicative: true, 
                source: 'camelot_v3',
                pool: camelotQuote.pool,
                gasEstimate: camelotQuote.gasEstimate
              }),
              expiresAt: new Date(Date.now() + 30000).toISOString(),
              chainId
            };
            
            await this.saveSwapQuote(quote, userId);
            return quote;
          } catch (camelotError) {
            console.error('Camelot V3 quote also failed:', camelotError);
            // Fall through to standard indicative price fallback
          }
        }
        
        // Standard fallback to indicative price (doesn't require balance)
        try {
          const priceResult = await zeroXSwapService.getPrice(inputAsset, outputAsset, sellAmount, chainId);
          const buyDecimals = getTokenDecimals(outputAsset);
          const outputAmount = parseFloat(ethers.formatUnits(priceResult.buyAmount, buyDecimals));
          const exchangeRate = outputAmount / inputAmount;

          // Approximate fees (platform fee already included in price endpoint)
          const platformFee = outputAmount * 0.008;
          const networkFee = 0;

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
            routeDetails: JSON.stringify({ indicative: true, source: '0x_price', priceResult }),
            expiresAt: new Date(Date.now() + 30000).toISOString(),
            chainId
          };
          
          await this.saveSwapQuote(quote, userId);
          return quote;
        } catch (priceError) {
          console.error('All quote methods failed:', priceError);
          throw new Error('Unable to generate quote: All routing options failed');
        }
      }

      // Parse amounts from successful gasless quote
      const buyDecimals = getTokenDecimals(outputAsset);
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

      // Determine route/source from stored quote
      const routeData: any = JSON.parse(quoteData.route as string);

      // If this quote was generated via Camelot V3, execute via Gelato relay
      if (routeData?.source === 'camelot_v3') {
        // Get user wallet address
        const { data: onchainWallet } = await supabase
          .from('onchain_addresses')
          .select('address')
          .eq('user_id', userId)
          .single();

        if (!onchainWallet?.address) {
          throw new Error('Wallet not found');
        }

        // Resolve token addresses and amounts
        const { getTokenAddress } = await import('@/config/tokenAddresses');
        const inAddr = getTokenAddress(quoteData.input_asset);
        const outAddr = getTokenAddress(quoteData.output_asset);

        const inDecimals = getTokenDecimals(quoteData.input_asset);
        const outDecimals = getTokenDecimals(quoteData.output_asset);

        const amountIn = ethers.parseUnits(String(quoteData.input_amount), inDecimals).toString();
        const minOutNum = Number(quoteData.output_amount) * 0.995; // 0.5% slippage
        const amountOutMinimum = ethers.parseUnits(minOutNum.toFixed(outDecimals), outDecimals).toString();

        // Submit Camelot swap via edge function (Gelato relay)
        const { data, error } = await supabase.functions.invoke('blockchain-operations', {
          body: {
            operation: 'camelot_swap',
            tokenIn: inAddr,
            tokenOut: outAddr,
            amountIn,
            amountOutMinimum,
            userAddress: onchainWallet.address,
            quoteId
          }
        });

        if (error) throw new Error(error.message || 'Camelot swap failed');
        if (!data?.success) throw new Error(data?.error || 'Camelot swap failed');

        return {
          success: true,
          gelatoTaskId: data.taskId
        };
      }

      // Parse the stored gasless quote (0x)
      const gaslessQuote: GaslessQuote = routeData as GaslessQuote;

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
      side: 'swap',
      input_asset: quote.inputAsset,
      output_asset: quote.outputAsset,
      input_amount: quote.inputAmount,
      output_amount: quote.outputAmount,
      unit_price_usd: null,
      fee_bps: 80,
      grams: null,
      route: quote.routeDetails as any,
      expires_at: quote.expiresAt,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error('Error saving quote:', error);
      throw new Error('Failed to save quote');
    }
  }

}

export const swapService = new SwapService();
