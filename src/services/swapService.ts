import { supabase } from "@/integrations/supabase/client";
import { zeroXGaslessService, GaslessQuote } from "./zeroXGaslessService";
import { zeroXSwapService } from "./zeroXSwapService";
import { swapFeeService } from "./swapFeeService";
import { walletSigningService } from "./walletSigningService";
import { getTokenDecimals, getTokenChainId } from "@/config/tokenAddresses";
import { ethers } from "ethers";

/**
 * Filter out EIP712Domain from types object for ethers.js v6 compatibility
 * The domain parameter already contains this information
 */
function filterEIP712Types(types: any): any {
  const { EIP712Domain, ...filteredTypes } = types;
  return filteredTypes;
}

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
    quote: SwapQuote,
    userId: string,
    walletPassword: string,
    useGasless: boolean = true // Always true with 0x Gasless
  ): Promise<SwapResult> {
    try {
      // ✅ PHASE 2: IDEMPOTENCY CHECK
      const { data: existingSwap } = await supabase
        .from('transactions')
        .select('id, status, metadata')
        .eq('quote_id', quote.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSwap) {
        // If swap already in progress or completed, reject with idempotency
        if (['pending', 'completed'].includes(existingSwap.status)) {
          console.warn(`⚠️ Idempotency: Swap already exists for quote ${quote.id}`, {
            swapId: existingSwap.id,
            status: existingSwap.status
          });
          
          // Log idempotency rejection
          import('@/utils/productionMonitoring').then(({ logSwapEvent }) => {
            logSwapEvent(quote.id, userId, 'idempotency_rejected', {
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

      // ✅ PHASE 3: QUOTE EXPIRATION MONITORING
      if (new Date() > new Date(quote.expiresAt)) {
        console.warn(`⏱️ Quote expired: ${quote.id}`);
        
        import('@/utils/productionMonitoring').then(({ logSwapEvent }) => {
          logSwapEvent(quote.id, userId, 'swap_failed', {
            reason: 'quote_expired',
            expiresAt: quote.expiresAt,
            attemptedAt: new Date().toISOString(),
            timeSinceExpiry: Date.now() - new Date(quote.expiresAt).getTime()
          });
        });
        
        throw new Error('Quote has expired. Please generate a new quote.');
      }

      // Get user wallet address for fresh gasless quote
      const { data: onchainWallet } = await supabase
        .from('onchain_addresses')
        .select('address')
        .eq('user_id', userId)
        .single();

      if (!onchainWallet?.address) {
        throw new Error('Wallet not found');
      }

      // Fetch fresh gasless quote with permit2 signatures (0x best practice)
      console.log('🔄 Fetching fresh 0x gasless quote for execution');
      const decimals = getTokenDecimals(quote.inputAsset);
      const sellAmount = ethers.parseUnits(quote.inputAmount.toString(), decimals).toString();

      const gaslessQuote = await zeroXGaslessService.getGaslessQuote(
        quote.inputAsset,
        quote.outputAsset,
        sellAmount,
        onchainWallet.address
      );

      console.log('✅ Fresh gasless quote obtained:', {
        buyAmount: gaslessQuote.buyAmount,
        chainId: gaslessQuote.chainId,
        hasApproval: !!gaslessQuote.approval,
        hasTrade: !!gaslessQuote.trade
      });

      // Determine route/source from quote
      const routeData: any = JSON.parse(quote.routeDetails);

      // If this quote was generated via Camelot V3, execute via Gelato relay
      if (routeData?.source === 'camelot_v3') {
        // Resolve token addresses and amounts
        const { getTokenAddress } = await import('@/config/tokenAddresses');
        const inAddr = getTokenAddress(quote.inputAsset);
        const outAddr = getTokenAddress(quote.outputAsset);

        const inDecimals = getTokenDecimals(quote.inputAsset);
        const outDecimals = getTokenDecimals(quote.outputAsset);

        const amountIn = ethers.parseUnits(String(quote.inputAmount), inDecimals).toString();
        const minOutNum = Number(quote.outputAmount) * 0.995; // 0.5% slippage
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
            quoteId: quote.id
          }
        });

        if (error) throw new Error(error.message || 'Camelot swap failed');
        if (!data?.success) throw new Error(data?.error || 'Camelot swap failed');

        return {
          success: true,
          gelatoTaskId: data.taskId
        };
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
        
        // Sign the trade and approval permits with user's wallet
        let approvalSignature: string | undefined;
        let tradeSignature: string | undefined;
        
        if (gaslessQuote.approval) {
          // ✅ Sign approval permit (EIP-712 signature for permit2)
          console.log('📝 Signing approval permit for allowanceTarget:', {
            allowanceTarget: gaslessQuote.allowanceTarget,
            primaryType: gaslessQuote.approval.eip712.primaryType || 'PermitTransferFrom',
            typesBeforeFilter: Object.keys(gaslessQuote.approval.eip712.types)
          });
          
          // ✅ Strip EIP712Domain from types (ethers.js v6 requirement)
          const filteredTypes = filterEIP712Types(gaslessQuote.approval.eip712.types);
          
          console.log('🔧 Filtered types:', {
            before: Object.keys(gaslessQuote.approval.eip712.types),
            after: Object.keys(filteredTypes)
          });
          
          approvalSignature = await walletSigningService.signTypedData(
            userId,
            walletPassword,
            gaslessQuote.chainId,
            gaslessQuote.approval.eip712.domain,
            filteredTypes,
            gaslessQuote.approval.eip712.message
          );
          
          console.log('✅ Approval signature generated');
        }
        
        if (gaslessQuote.trade) {
          // ✅ Sign trade permit (EIP-712 signature for trade execution)
          console.log('📝 Signing trade permit');
          
          // ✅ Strip EIP712Domain from types (ethers.js v6 requirement)
          const filteredTypes = filterEIP712Types(gaslessQuote.trade.eip712.types);
          
          tradeSignature = await walletSigningService.signTypedData(
            userId,
            walletPassword,
            gaslessQuote.chainId,
            gaslessQuote.trade.eip712.domain,
            filteredTypes,
            gaslessQuote.trade.eip712.message
          );
          
          console.log('✅ Trade signature generated');
        }

        if (!tradeSignature) {
          throw new Error('No trade signature generated - required for gasless swap');
        }
        if (gaslessQuote.approval && !approvalSignature) {
          throw new Error('Approval signature missing for required approval step');
        }

        // Submit to 0x gasless endpoint with auto-recovery
        let submitResult;
        try {
          submitResult = await zeroXGaslessService.submitGaslessSwap(
            gaslessQuote,
            { approval: approvalSignature, trade: tradeSignature },
            quote.id,
            intentId
          );
        } catch (error: any) {
          // Auto-recovery for expired/stale quotes
          if (error.message?.startsWith('EXPIRED:')) {
            console.warn('⏱️ Quote expired during submission, refreshing and retrying...');
            
            // Fetch fresh quote
            const freshQuote = await zeroXGaslessService.getGaslessQuote(
              quote.inputAsset,
              quote.outputAsset,
              sellAmount,
              onchainWallet.address
            );

            // Re-sign with fresh quote
            let freshApprovalSig: string | undefined;
            if (freshQuote.approval) {
              const filteredTypes = filterEIP712Types(freshQuote.approval.eip712.types);
              freshApprovalSig = await walletSigningService.signTypedData(
                userId,
                walletPassword,
                freshQuote.chainId,
                freshQuote.approval.eip712.domain,
                filteredTypes,
                freshQuote.approval.eip712.message
              );
            }

            const freshTradeSig = await walletSigningService.signTypedData(
              userId,
              walletPassword,
              freshQuote.chainId,
              freshQuote.trade.eip712.domain,
              filterEIP712Types(freshQuote.trade.eip712.types),
              freshQuote.trade.eip712.message
            );

            console.log('✅ Fresh signatures generated, retrying submit...');

            // Retry submission with fresh signatures
            submitResult = await zeroXGaslessService.submitGaslessSwap(
              freshQuote,
              { approval: freshApprovalSig, trade: freshTradeSig },
              quote.id,
              intentId
            );
          } else {
            // Preserve 0x error details for UI
            throw error;
          }
        }

        // Wait for completion (with timeout)
        const statusResult = await zeroXGaslessService.waitForCompletion(
          submitResult.tradeHash,
          gaslessQuote.chainId,
          60, // 60 attempts
          2000 // 2 seconds interval
        );

        if (statusResult.status === 'confirmed' && statusResult.transactions.length > 0) {
          const txHash = statusResult.transactions[0].hash;

          // Record transaction with proper schema + idempotency metadata
          const idempotencyKey = `swap_${quote.id}_${Date.now()}`;
          
          const { error: txError } = await supabase
            .from('transactions')
            .insert({
              user_id: userId,
              quote_id: quote.id, // ✅ Link to quote for idempotency
              asset: quote.outputAsset, // Asset received
              type: 'swap',
              status: 'completed',
              quantity: quote.outputAmount, // Output amount
              unit_price_usd: 0,
              fee_usd: 80,
              transaction_hash: txHash,
              input_asset: quote.inputAsset,
              output_asset: quote.outputAsset,
              metadata: {
                chainId: gaslessQuote.chainId,
                tradeHash: submitResult.tradeHash,
                gasless: true,
                quoteId: quote.id,
                idempotency_key: idempotencyKey, // ✅ Track idempotency
                submission_timestamp: Date.now(),
                quote_used: quote.id
              },
              created_at: new Date().toISOString()
            });

          // Record fee collection with proper transaction ID
          const feeCalculation = swapFeeService.calculateSwapFee(
            quote.inputAmount,
            quote.inputAsset as any,
            quote.outputAsset as any
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
