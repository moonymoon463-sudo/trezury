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

      // Fetch 0x indicative price (no balance check)
      const priceResult = await zeroXSwapService.getPrice(inputAsset, outputAsset, sellAmount, chainId);
      
      // Format output amount
      const buyDecimals = getTokenDecimals(outputAsset);
      const outputAmount = parseFloat(ethers.formatUnits(priceResult.buyAmount, buyDecimals));
      const exchangeRate = outputAmount / inputAmount;

      // Calculate platform fee (0.8%)
      const platformFee = outputAmount * 0.008;
      const networkFee = 0;

      // Return quote (no database save)
      const quote: SwapQuote = {
        id: crypto.randomUUID(),
        inputAsset,
        outputAsset,
        inputAmount,
        outputAmount,
        exchangeRate,
        platformFee,
        networkFee,
        estimatedTotal: outputAmount - platformFee,
        routeDetails: JSON.stringify({ source: '0x_price', priceResult }),
        expiresAt: new Date(Date.now() + 30000).toISOString(),
        chainId
      };

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
        // ✅ CRITICAL: Check if approval is needed for allowanceTarget
        // The allowanceTarget is the ONLY address we should approve
        // This will be either:
        // - AllowanceHolder contract (for standard permit2 flows)
        // - Permit2 contract (0x000000000022D473030F116dDEE9F6B43aC78BA3)
        // NEVER approve the Settler contract!
        
        if (gaslessQuote.allowanceTarget) {
          console.log('✅ Swap using allowanceTarget:', {
            allowanceTarget: gaslessQuote.allowanceTarget,
            sellToken: gaslessQuote.sellToken,
            sellAmount: gaslessQuote.sellAmount,
            note: 'This is the ONLY address we approve for token transfers'
          });
        }
        
        // Sign the trade permit with user's wallet
        let signature: string = '';
        
        if (gaslessQuote.approval) {
          // ✅ Sign approval permit (EIP-712 signature for permit2)
          console.log('📝 Signing approval permit for allowanceTarget:', {
            allowanceTarget: gaslessQuote.allowanceTarget,
            primaryType: gaslessQuote.approval.eip712.primaryType || 'PermitTransferFrom'
          });
          
          signature = await walletSigningService.signTypedData(
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
          // ✅ Sign trade permit (EIP-712 signature for trade execution)
          console.log('📝 Signing trade permit');
          
          signature = await walletSigningService.signTypedData(
            userId,
            walletPassword,
            gaslessQuote.chainId,
            gaslessQuote.trade.eip712.domain,
            gaslessQuote.trade.eip712.types,
            gaslessQuote.trade.eip712.message
          );
          
          console.log('✅ Trade signature generated');
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


}

export const swapService = new SwapService();
