import { supabase } from "@/integrations/supabase/client";
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
   * Generate a swap quote using 0x indicative price (no balance check, no DB save)
   */
  async generateSwapQuote(
    inputAsset: string,
    outputAsset: string,
    inputAmount: number,
    userId: string
  ): Promise<SwapQuote> {
    try {
      // Get chain ID and format amount for 0x API
      const chainId = getTokenChainId(inputAsset);
      const decimals = getTokenDecimals(inputAsset);
      const sellAmount = ethers.parseUnits(inputAmount.toString(), decimals).toString();

      // Fetch 0x indicative price via edge function
      const { data: response, error } = await supabase.functions.invoke('swap-0x-gasless', {
        body: {
          operation: 'get_price',
          sellToken: inputAsset,
          buyToken: outputAsset,
          sellAmount,
          chainId
        }
      });

      if (error) {
        console.error('Edge function invocation error:', error);
        throw new Error(error.message || 'Failed to invoke swap edge function');
      }

      if (!response?.success) {
        const errorMsg = response?.message || response?.error || 'Failed to get price quote';
        console.error('0x API error:', { response });
        throw new Error(errorMsg);
      }

      const priceData = response.price;
      if (!priceData || !priceData.buyAmount) {
        console.error('Invalid price response structure:', { response });
        throw new Error('Invalid price response: missing buyAmount');
      }

      console.log('✅ Indicative price extracted:', {
        buyAmount: priceData.buyAmount,
        sellAmount: priceData.sellAmount
      });
      
      // Format output amount
      const buyDecimals = getTokenDecimals(outputAsset);
      const outputAmount = parseFloat(ethers.formatUnits(priceData.buyAmount, buyDecimals));
      const exchangeRate = outputAmount / inputAmount;

      // Calculate platform fee (0.8%)
      const platformFee = outputAmount * 0.008;
      const networkFee = 0;

      // Generate quote with 2-minute expiry
      const quoteId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 120000).toISOString(); // 2 minutes
      
      const quote: SwapQuote = {
        id: quoteId,
        inputAsset,
        outputAsset,
        inputAmount,
        outputAmount,
        exchangeRate,
        platformFee,
        networkFee,
        estimatedTotal: outputAmount - platformFee,
        routeDetails: JSON.stringify({ source: '0x_price', priceData }),
        expiresAt,
        chainId
      };

      // Save quote to database for persistence
      const { error: insertError } = await supabase.from('quotes').insert({
        id: quoteId,
        user_id: userId,
        input_asset: inputAsset,
        output_asset: outputAsset,
        input_amount: inputAmount,
        output_amount: outputAmount,
        fee_bps: 80,
        expires_at: expiresAt,
        side: 'SWAP',
        grams: 0,
        unit_price_usd: exchangeRate,
        route: { source: '0x_price', priceData }
      });

      if (insertError) {
        console.error('❌ Failed to save quote to Supabase:', insertError);
        throw new Error(`Failed to save quote: ${insertError.message}`);
      }

      console.log('✅ Quote generated and saved:', { id: quoteId });

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
        // Get firm quote with EIP-712 payloads via edge function
        const chainId = getTokenChainId(quoteData.input_asset);
        const { data: quoteResponse, error: quoteError } = await supabase.functions.invoke('swap-0x-gasless', {
          body: {
            operation: 'get_quote',
            sellToken: quoteData.input_asset,
            buyToken: quoteData.output_asset,
            sellAmount: ethers.parseUnits(
              String(quoteData.input_amount),
              getTokenDecimals(quoteData.input_asset)
            ).toString(),
            userAddress: onchainWallet.address,
            chainId
          }
        });

        if (quoteError) {
          console.error('Edge function invocation error:', quoteError);
          throw new Error(quoteError.message || 'Failed to invoke swap edge function for quote');
        }

        if (!quoteResponse?.success) {
          const errorMsg = quoteResponse?.message || quoteResponse?.error || 'Failed to get firm quote';
          console.error('0x Gasless API error:', { quoteResponse });
          throw new Error(errorMsg);
        }

        const gaslessQuote = quoteResponse.quote;
        if (!gaslessQuote) {
          console.error('Invalid quote response structure:', { quoteResponse });
          throw new Error('Invalid quote response: missing quote data');
        }
        
        console.log('✅ Got firm quote with EIP-712 payloads:', {
          hasApproval: !!gaslessQuote.approval,
          hasTrade: !!gaslessQuote.trade
        });
        
        // Sign the permits with user's wallet
        let approvalSignature: string | undefined;
        let tradeSignature: string | undefined;
        
        if (gaslessQuote.approval) {
          console.log('📝 Signing approval permit');
          approvalSignature = await walletSigningService.signTypedData(
            userId,
            walletPassword,
            gaslessQuote.chainId,
            gaslessQuote.approval.eip712.domain,
            gaslessQuote.approval.eip712.types,
            gaslessQuote.approval.eip712.message
          );
          console.log('✅ Approval signature generated');
        }
        
        if (gaslessQuote.trade) {
          console.log('📝 Signing trade permit');
          tradeSignature = await walletSigningService.signTypedData(
            userId,
            walletPassword,
            gaslessQuote.chainId,
            gaslessQuote.trade.eip712.domain,
            gaslessQuote.trade.eip712.types,
            gaslessQuote.trade.eip712.message
          );
          console.log('✅ Trade signature generated');
        }

        if (!approvalSignature && !tradeSignature) {
          throw new Error('No signatures generated');
        }

        // Submit swap via edge function
        const { data: submitResult, error: submitError } = await supabase.functions.invoke('swap-0x-gasless', {
          body: {
            operation: 'submit_swap',
            quote: gaslessQuote,
            approval: approvalSignature ? {
              signature: approvalSignature,
              ...gaslessQuote.approval
            } : undefined,
            trade: tradeSignature ? {
              signature: tradeSignature,
              ...gaslessQuote.trade
            } : undefined
          }
        });

        if (submitError) {
          console.error('Edge function invocation error:', submitError);
          throw new Error(submitError.message || 'Failed to invoke swap edge function for submission');
        }

        if (!submitResult?.success) {
          const errorMsg = submitResult?.message || submitResult?.error || 'Failed to submit swap';
          console.error('0x Gasless submit error:', { submitResult });
          throw new Error(errorMsg);
        }

        const tradeHash = submitResult.result?.tradeHash || submitResult.tradeHash;
        if (!tradeHash) {
          console.error('Invalid submit response:', { submitResult });
          throw new Error('Invalid submit response: missing tradeHash');
        }

        console.log('✅ Swap submitted, tradeHash:', tradeHash);

        // Poll for completion via edge function
        let statusResult;
        for (let i = 0; i < 60; i++) {
          const { data: statusResponse } = await supabase.functions.invoke('swap-0x-gasless', {
            body: {
              operation: 'get_status',
              tradeHash
            }
          });

          const status = statusResponse?.status || statusResponse;

          if (status?.status === 'confirmed' && status.transactions?.length > 0) {
            statusResult = status;
            break;
          }

          if (status?.status === 'failed') {
            throw new Error('Swap failed on-chain');
          }

          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (!statusResult) {
          throw new Error('Swap status polling timeout');
        }

        const txHash = statusResult.transactions[0].hash;

        // Record transaction with proper schema + idempotency metadata
        const idempotencyKey = `swap_${quoteId}_${Date.now()}`;
        
        await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            quote_id: quoteId,
            asset: quoteData.output_asset,
            type: 'swap',
            status: 'completed',
            quantity: quoteData.output_amount,
            unit_price_usd: quoteData.unit_price_usd || 0,
            fee_usd: quoteData.fee_bps || 80,
            transaction_hash: txHash,
            input_asset: quoteData.input_asset,
            output_asset: quoteData.output_asset,
            metadata: {
              chainId: gaslessQuote.chainId,
              tradeHash,
              gasless: true,
              quoteId,
              idempotency_key: idempotencyKey,
              submission_timestamp: Date.now(),
              quote_used: quoteId
            },
            created_at: new Date().toISOString()
          });

        // Record fee collection
        const feeCalculation = swapFeeService.calculateSwapFee(
          quoteData.input_amount,
          quoteData.input_asset as any,
          quoteData.output_asset as any
        );

        await swapFeeService.recordSwapFeeCollection(userId, txHash, feeCalculation);

        return {
          success: true,
          txHash,
          tradeHash,
          intentId,
          hash: txHash
        };
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


}

export const swapService = new SwapService();
