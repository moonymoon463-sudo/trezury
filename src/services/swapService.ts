import { supabase } from "@/integrations/supabase/client";
import { swapFeeService } from "./swapFeeService";
import { walletSigningService } from "./walletSigningService";
import { getTokenDecimals, getTokenChainId } from "@/config/tokenAddresses";
import { ethers } from "ethers";

// Utility to sanitize objects for JSON serialization (remove BigInt, undefined)
function sanitizeForJson(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(sanitizeForJson);
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        sanitized[key] = sanitizeForJson(value);
      }
    }
    return sanitized;
  }
  return obj;
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

      // Determine route/source from stored quote (handle both string and object formats)
      const routeData: any = typeof quoteData.route === 'string' 
        ? JSON.parse(quoteData.route) 
        : quoteData.route;

      // Get user's primary/preferred wallet address using same logic as secureWalletService
      const { data: wallets } = await supabase
        .from('onchain_addresses')
        .select('address, setup_method, created_at, is_primary')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!wallets || wallets.length === 0) {
        throw new Error('Wallet not found');
      }

      // Select primary wallet or earliest with preferred setup method
      const primaryWallet = wallets.find(w => w.is_primary);
      const preferredWallet = wallets.find(w => 
        ['imported_key', 'legacy', 'user_password'].includes(w.setup_method || '')
      );
      const selectedWallet = primaryWallet || preferredWallet || wallets[0];

      if (!selectedWallet?.address) {
        throw new Error('Wallet not found');
      }

      const walletAddress = selectedWallet.address;

      const chainId = getTokenChainId(quoteData.input_asset);

      // Pre-submit wallet/password validation
      console.log('🔐 Verifying wallet password matches on-chain address...');
      try {
        const derivedWallet = await walletSigningService.getWalletForSigning(userId, walletPassword, chainId);
        if (derivedWallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
          throw new Error('Wrong wallet password. If you changed your account password after creating this wallet, please use your old password or contact support to rotate your wallet encryption.');
        }
        console.log('✅ Wallet password validated');
      } catch (err) {
        console.error('❌ Wallet validation failed:', err);
        const errorMsg = err instanceof Error ? err.message : 'Wallet password validation failed';
        if (errorMsg.includes('Encrypted wallet not found')) {
          throw new Error('Wrong wallet password. If you changed your account password after creating this wallet, please use your old password or contact support to rotate your wallet encryption.');
        }
        throw new Error(errorMsg);
      }

      // Create transaction record
      const intentId = crypto.randomUUID();

      try {
        // Get firm quote with EIP-712 payloads via edge function
        console.log('📝 Requesting firm quote from 0x...');
        const { data: quoteResponse, error: quoteError } = await supabase.functions.invoke('swap-0x-gasless', {
          body: {
            operation: 'get_quote',
            sellToken: quoteData.input_asset,
            buyToken: quoteData.output_asset,
            sellAmount: ethers.parseUnits(
              String(quoteData.input_amount),
              getTokenDecimals(quoteData.input_asset)
            ).toString(),
            userAddress: walletAddress,
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
        
        console.log('✅ got_quote - Firm quote received:', {
          hasApproval: !!gaslessQuote.approval,
          hasTrade: !!gaslessQuote.trade,
          chainId: gaslessQuote.chainId,
          approvalKeys: gaslessQuote.approval ? Object.keys(gaslessQuote.approval) : [],
          tradeKeys: gaslessQuote.trade ? Object.keys(gaslessQuote.trade) : []
        });
        
        // Sign the permits with user's wallet
        let approvalSignature: string | undefined;
        let tradeSignature: string | undefined;
        
        if (gaslessQuote.approval) {
          console.log('📝 signing_approval');
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
          console.log('📝 signing_trade');
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

        // Build submit payload according to 0x API spec
        // approval/trade.signature must be an object (not a string)
        const submitApproval = approvalSignature ? {
          ...gaslessQuote.approval,
          signature: {
            type: 'eip712',
            signature: approvalSignature,
            // also include signatureType for safety if the API expects this key
            signatureType: gaslessQuote.approval?.type || 'eip712'
          }
        } : undefined;

        const submitTrade = tradeSignature ? {
          ...gaslessQuote.trade,
          signature: {
            type: 'eip712',
            signature: tradeSignature,
            signatureType: gaslessQuote.trade?.type || 'eip712'
          }
        } : undefined;

        console.log('📤 submit_invoked - Submitting swap with explicit chainId:', chainId);
        
        // Submit swap via edge function with explicit chainId
        const { data: submitResult, error: submitError } = await supabase.functions.invoke('swap-0x-gasless', {
          body: {
            operation: 'submit_swap',
            chainId,
            quote: sanitizeForJson(gaslessQuote),
            approval: submitApproval ? sanitizeForJson(submitApproval) : undefined,
            trade: submitTrade ? sanitizeForJson(submitTrade) : undefined,
            quoteId
          }
        });

        if (submitError) {
          console.error('Edge function invocation error:', submitError);
          throw new Error(submitError.message || 'Failed to invoke swap edge function for submission');
        }

        if (!submitResult?.success) {
          const errorMsg = submitResult?.message || submitResult?.error || 'Failed to submit swap';
          console.error('0x Gasless submit error:', { submitResult });
          
          // Improve error mapping
          let userFacingError = errorMsg;
          if (errorMsg.toLowerCase().includes('signature')) {
            userFacingError = 'Invalid wallet password or wallet mismatch. Please try again.';
          } else if (submitResult?.status === 401 || submitResult?.status === 403) {
            userFacingError = 'API authentication failed. Please contact support.';
          } else if (submitResult?.status === 404 || errorMsg.toLowerCase().includes('no route')) {
            userFacingError = 'No liquidity available for this swap. Try a different amount or pair.';
          }
          
          throw new Error(userFacingError);
        }

        const tradeHash = submitResult.result?.tradeHash || submitResult.tradeHash;
        if (!tradeHash) {
          console.error('Invalid submit response:', { submitResult });
          throw new Error('Invalid submit response: missing tradeHash');
        }

        console.log('✅ submit_ok - Swap submitted, tradeHash:', tradeHash);

        // Poll for completion via edge function
        let statusResult;
        console.log('⏳ Polling for transaction confirmation...');
        for (let i = 0; i < 60; i++) {
        const { data: statusResponse } = await supabase.functions.invoke('swap-0x-gasless', {
          body: {
            operation: 'get_status',
            tradeHash,
            chainId // Pass chainId for cross-chain status checks
          }
        });

          const status = statusResponse?.status || statusResponse;

          if (status?.status === 'confirmed' && status.transactions?.length > 0) {
            statusResult = status;
            console.log('✅ status_poll_ok - Transaction confirmed!');
            break;
          }

          if (status?.status === 'failed') {
            console.error('❌ status_failed - Swap failed on-chain');
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
        
        console.log('💾 Recording transaction to database...');
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
            tx_hash: txHash, // Fixed: was transaction_hash
            chain: 'ethereum',
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
