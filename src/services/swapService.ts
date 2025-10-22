import { supabase } from "@/integrations/supabase/client";
import { swapFeeService } from "./swapFeeService";
import { walletSigningService } from "./walletSigningService";
import { getTokenDecimals, getTokenChainId } from "@/config/tokenAddresses";
import { ethers } from "ethers";

// ===========================
// Type Definitions
// ===========================

interface EIP712Signature {
  r: string;
  s: string;
  v: number;
  signatureType: 2;
}

interface TokenPermissions {
  token: string;
  amount: string;
}

interface Permit2Approval {
  eip712: {
    domain: any;
    types: any;
    message: any;
  };
  signature?: EIP712Signature;
}

interface Permit2Trade {
  eip712: {
    domain: any;
    types: any;
    message: any;
  };
  signature?: EIP712Signature;
}

interface ZeroXGaslessQuote {
  chainId: number;
  buyAmount: string;
  sellAmount: string;
  approval: Permit2Approval;
  trade: Permit2Trade;
  allowanceTarget?: string;
}

interface SwapSubmitPayload {
  operation: 'submit_swap';
  chainId: number;
  quote: ZeroXGaslessQuote;
  approval?: Permit2Approval;
  trade?: Permit2Trade;
  quoteId: string;
}

interface SwapStatusResult {
  status: 'pending' | 'confirmed' | 'failed';
  transactions: Array<{ hash: string }>;
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
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  error?: string;
  tradeHash?: string;
}

// ===========================
// Utility Functions
// ===========================

/**
 * Sanitize objects for JSON serialization (remove BigInt, undefined)
 */
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

/**
 * Parse EIP-712 signature into 0x API v2 format
 * Returns { r, s, v, signatureType: 2 } with v as a number
 */
function parseSignatureToZeroXFormat(signature: string): EIP712Signature {
  const sig = ethers.Signature.from(signature);
  
  // Ensure v is a number (27 or 28 for Ethereum signatures)
  const v = typeof sig.v === 'number' ? sig.v : parseInt(String(sig.v), 10);
  
  if (isNaN(v) || (v !== 27 && v !== 28)) {
    throw new Error(`Invalid signature v value: ${v}. Expected 27 or 28.`);
  }
  
  return {
    r: sig.r,
    s: sig.s,
    v,
    signatureType: 2 // EIP-712 signature type for 0x
  };
}

/**
 * Validate and normalize chainId
 * Ensures chainId is always a valid number, never NaN or undefined
 */
function validateChainId(chainId: any, context: string): number {
  const normalized = Number(chainId);
  
  if (!Number.isFinite(normalized) || isNaN(normalized) || normalized <= 0) {
    throw new Error(`Invalid chainId in ${context}: ${chainId}. Must be a positive number.`);
  }
  
  return normalized;
}

/**
 * Log structured swap event for debugging
 */
function logSwapEvent(
  stage: string,
  data: Record<string, any>,
  level: 'info' | 'warn' | 'error' = 'info'
) {
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  console[level](`${prefix} [SWAP:${stage}]`, data);
}

// ===========================
// Swap Service Implementation
// ===========================

class SwapService {
  /**
   * Generate a swap quote using 0x indicative price
   */
  async generateSwapQuote(
    inputAsset: string,
    outputAsset: string,
    inputAmount: number,
    userId: string
  ): Promise<SwapQuote> {
    try {
      // Validate inputs
      if (!inputAsset || !outputAsset) {
        throw new Error('Input and output assets are required');
      }
      if (inputAmount <= 0) {
        throw new Error('Input amount must be positive');
      }

      // Get chain configuration
      const chainId = validateChainId(
        getTokenChainId(inputAsset),
        'generateSwapQuote'
      );
      const decimals = getTokenDecimals(inputAsset);
      const sellAmount = ethers.parseUnits(inputAmount.toString(), decimals).toString();

      logSwapEvent('quote_request', {
        inputAsset,
        outputAsset,
        inputAmount,
        chainId,
        sellAmount
      });

      // Fetch indicative price from 0x via edge function
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
        logSwapEvent('quote_error', { error: error.message }, 'error');
        throw new Error(error.message || 'Failed to fetch swap quote');
      }

      if (!response?.success) {
        const errorMsg = response?.message || response?.error || 'Failed to get price quote';
        logSwapEvent('quote_failed', { response }, 'error');
        throw new Error(errorMsg);
      }

      const priceData = response.price;
      if (!priceData?.buyAmount) {
        logSwapEvent('invalid_price_response', { response }, 'error');
        throw new Error('Invalid price response: missing buyAmount');
      }

      // Calculate output amount and fees
      const buyDecimals = getTokenDecimals(outputAsset);
      const outputAmount = parseFloat(ethers.formatUnits(priceData.buyAmount, buyDecimals));
      const exchangeRate = outputAmount / inputAmount;
      const platformFee = outputAmount * 0.008; // 0.8% platform fee
      const networkFee = 0; // Gasless swaps have no user-facing network fee

      // Generate quote with 2-minute expiry
      const quoteId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 120000).toISOString();

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

      // Save quote to database
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
        logSwapEvent('quote_save_error', { error: insertError.message }, 'error');
        throw new Error(`Failed to save quote: ${insertError.message}`);
      }

      logSwapEvent('quote_generated', { quoteId, outputAmount, platformFee });

      return quote;
    } catch (error) {
      logSwapEvent('quote_exception', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'error');
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
    useGasless: boolean = true
  ): Promise<SwapResult> {
    try {
      logSwapEvent('execute_start', { quoteId, userId });

      // ===== IDEMPOTENCY CHECK =====
      const { data: existingSwap } = await supabase
        .from('transactions')
        .select('id, status, metadata')
        .eq('quote_id', quoteId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSwap && ['pending', 'completed'].includes(existingSwap.status)) {
        logSwapEvent('idempotency_rejected', {
          quoteId,
          existingStatus: existingSwap.status
        }, 'warn');
        
        return {
          success: false,
          error: 'Swap already in progress for this quote. Please generate a new quote.'
        };
      }

      // ===== FETCH QUOTE =====
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .eq('user_id', userId)
        .single();

      if (quoteError || !quoteData) {
        throw new Error('Quote not found or expired');
      }

      // ===== QUOTE EXPIRATION CHECK =====
      if (new Date() > new Date(quoteData.expires_at)) {
        logSwapEvent('quote_expired', {
          quoteId,
          expiresAt: quoteData.expires_at
        }, 'warn');
        throw new Error('Quote has expired. Please generate a new quote.');
      }

      // ===== GET USER WALLET =====
      const { data: wallets } = await supabase
        .from('onchain_addresses')
        .select('address, setup_method, created_at, is_primary')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!wallets || wallets.length === 0) {
        throw new Error('Wallet not found');
      }

      const primaryWallet = wallets.find(w => w.is_primary);
      const preferredWallet = wallets.find(w => 
        ['imported_key', 'legacy', 'user_password'].includes(w.setup_method || '')
      );
      const selectedWallet = primaryWallet || preferredWallet || wallets[0];

      if (!selectedWallet?.address) {
        throw new Error('Wallet not found');
      }

      const walletAddress = selectedWallet.address;
      const chainId = validateChainId(
        getTokenChainId(quoteData.input_asset),
        'executeSwap'
      );

      logSwapEvent('wallet_selected', { walletAddress, chainId });

      // ===== VALIDATE WALLET PASSWORD =====
      try {
        const derivedWallet = await walletSigningService.getWalletForSigning(
          userId,
          walletPassword,
          chainId
        );
        
        if (derivedWallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
          throw new Error('Wallet password mismatch');
        }
        
        logSwapEvent('wallet_validated', { walletAddress });
      } catch (err) {
        logSwapEvent('wallet_validation_failed', {
          error: err instanceof Error ? err.message : 'Unknown error'
        }, 'error');
        
        const errorMsg = err instanceof Error ? err.message : 'Wallet password validation failed';
        if (errorMsg.includes('Encrypted wallet not found')) {
          throw new Error('Wrong wallet password. Please use your wallet encryption password.');
        }
        throw new Error(errorMsg);
      }

      // ===== GET FIRM QUOTE =====
      logSwapEvent('requesting_firm_quote', { chainId });
      
      const { data: quoteResponse, error: firmQuoteError } = await supabase.functions.invoke(
        'swap-0x-gasless',
        {
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
        }
      );

      if (firmQuoteError) {
        logSwapEvent('firm_quote_error', { error: firmQuoteError.message }, 'error');
        throw new Error(firmQuoteError.message || 'Failed to get firm quote');
      }

      if (!quoteResponse?.success) {
        const errorMsg = quoteResponse?.message || quoteResponse?.error || 'Failed to get firm quote';
        logSwapEvent('firm_quote_failed', { quoteResponse }, 'error');
        throw new Error(errorMsg);
      }

      const gaslessQuote: ZeroXGaslessQuote = quoteResponse.quote;
      if (!gaslessQuote) {
        throw new Error('Invalid quote response: missing quote data');
      }

      // CRITICAL: 0x API doesn't return chainId in quote, so we must set it explicitly
      // This ensures chainId is always available for signing and submission
      gaslessQuote.chainId = chainId;
      
      logSwapEvent('firm_quote_received', {
        chainId: gaslessQuote.chainId,
        hasApproval: !!gaslessQuote.approval,
        hasTrade: !!gaslessQuote.trade
      });

      // ===== SIGN PERMITS =====
      let approvalSignature: string | undefined;
      let tradeSignature: string | undefined;

      if (gaslessQuote.approval?.eip712) {
        logSwapEvent('signing_approval', { chainId: gaslessQuote.chainId });
        
        approvalSignature = await walletSigningService.signTypedData(
          userId,
          walletPassword,
          gaslessQuote.chainId,
          gaslessQuote.approval.eip712.domain,
          gaslessQuote.approval.eip712.types,
          gaslessQuote.approval.eip712.message
        );
        
        logSwapEvent('approval_signed', { signatureLength: approvalSignature.length });
      }

      if (gaslessQuote.trade?.eip712) {
        logSwapEvent('signing_trade', { chainId: gaslessQuote.chainId });
        
        tradeSignature = await walletSigningService.signTypedData(
          userId,
          walletPassword,
          gaslessQuote.chainId,
          gaslessQuote.trade.eip712.domain,
          gaslessQuote.trade.eip712.types,
          gaslessQuote.trade.eip712.message
        );
        
        logSwapEvent('trade_signed', { signatureLength: tradeSignature.length });
      }

      if (!approvalSignature && !tradeSignature) {
        throw new Error('No signatures generated');
      }

      // ===== BUILD SUBMIT PAYLOAD =====
      const submitApproval: Permit2Approval | undefined = approvalSignature
        ? {
            ...gaslessQuote.approval,
            signature: parseSignatureToZeroXFormat(approvalSignature)
          }
        : undefined;

      const submitTrade: Permit2Trade | undefined = tradeSignature
        ? {
            ...gaslessQuote.trade,
            signature: parseSignatureToZeroXFormat(tradeSignature)
          }
        : undefined;

      // Log signature structure for debugging
      if (submitApproval?.signature) {
        logSwapEvent('approval_signature_parsed', {
          r: submitApproval.signature.r.substring(0, 10) + '...',
          s: submitApproval.signature.s.substring(0, 10) + '...',
          v: submitApproval.signature.v,
          vType: typeof submitApproval.signature.v,
          signatureType: submitApproval.signature.signatureType
        });
      }

      if (submitTrade?.signature) {
        logSwapEvent('trade_signature_parsed', {
          r: submitTrade.signature.r.substring(0, 10) + '...',
          s: submitTrade.signature.s.substring(0, 10) + '...',
          v: submitTrade.signature.v,
          vType: typeof submitTrade.signature.v,
          signatureType: submitTrade.signature.signatureType
        });
      }

      // ===== SUBMIT SWAP =====
      logSwapEvent('submitting_swap', { chainId });

      const submitPayload: SwapSubmitPayload = {
        operation: 'submit_swap',
        chainId,
        quote: sanitizeForJson(gaslessQuote),
        approval: submitApproval ? sanitizeForJson(submitApproval) : undefined,
        trade: submitTrade ? sanitizeForJson(submitTrade) : undefined,
        quoteId
      };

      const { data: submitResult, error: submitError } = await supabase.functions.invoke(
        'swap-0x-gasless',
        { body: submitPayload }
      );

      if (submitError) {
        logSwapEvent('submit_error', { error: submitError.message }, 'error');
        throw new Error(submitError.message || 'Failed to submit swap');
      }

      if (!submitResult?.success) {
        const errorMsg = submitResult?.message || submitResult?.error || 'Failed to submit swap';
        logSwapEvent('submit_failed', { submitResult }, 'error');
        
        // Map common errors to user-friendly messages
        let userFacingError = errorMsg;
        if (errorMsg.toLowerCase().includes('signature') || errorMsg.toLowerCase().includes('invalid input')) {
          userFacingError = 'Invalid signature format. Please try again.';
        } else if (submitResult?.status === 401 || submitResult?.status === 403) {
          userFacingError = 'API authentication failed. Please contact support.';
        } else if (submitResult?.status === 404 || errorMsg.toLowerCase().includes('no route')) {
          userFacingError = 'No liquidity available for this swap. Try a different amount or pair.';
        }
        
        throw new Error(userFacingError);
      }

      const tradeHash = submitResult.result?.tradeHash || submitResult.tradeHash;
      if (!tradeHash) {
        logSwapEvent('submit_missing_tradehash', { submitResult }, 'error');
        throw new Error('Invalid submit response: missing tradeHash');
      }

      logSwapEvent('swap_submitted', { tradeHash });

      // ===== POLL FOR CONFIRMATION =====
      let statusResult: SwapStatusResult | undefined;
      const maxPolls = 60;
      const pollInterval = 2000; // 2 seconds

      logSwapEvent('polling_start', { tradeHash, chainId });

      for (let i = 0; i < maxPolls; i++) {
        const { data: statusResponse } = await supabase.functions.invoke('swap-0x-gasless', {
          body: {
            operation: 'get_status',
            tradeHash,
            chainId
          }
        });

        const status = statusResponse?.status || statusResponse;

        if (status?.status === 'confirmed' && status.transactions?.length > 0) {
          statusResult = status;
          logSwapEvent('swap_confirmed', { txHash: status.transactions[0].hash });
          break;
        }

        if (status?.status === 'failed') {
          logSwapEvent('swap_failed_onchain', { tradeHash }, 'error');
          throw new Error('Swap failed on-chain');
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      if (!statusResult) {
        logSwapEvent('polling_timeout', { tradeHash }, 'error');
        throw new Error('Swap status polling timeout');
      }

      const txHash = statusResult.transactions[0].hash;

      // ===== RECORD TRANSACTION =====
      logSwapEvent('recording_transaction', { txHash, quoteId });

      const idempotencyKey = `swap_${quoteId}_${Date.now()}`;

      await supabase.from('transactions').insert({
        user_id: userId,
        quote_id: quoteId,
        asset: quoteData.output_asset,
        type: 'swap',
        status: 'completed',
        quantity: quoteData.output_amount,
        unit_price_usd: quoteData.unit_price_usd || 0,
        fee_usd: quoteData.fee_bps || 80,
        tx_hash: txHash,
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
        }
      });

      // ===== RECORD FEES =====
      const feeCalculation = swapFeeService.calculateSwapFee(
        quoteData.input_amount,
        quoteData.input_asset as any,
        quoteData.output_asset as any
      );

      await swapFeeService.recordSwapFeeCollection(userId, txHash, feeCalculation);

      logSwapEvent('swap_complete', { txHash, tradeHash });

      return {
        success: true,
        txHash,
        tradeHash
      };
    } catch (error) {
      logSwapEvent('execute_exception', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 'error');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Swap execution failed'
      };
    }
  }
}

export const swapService = new SwapService();
