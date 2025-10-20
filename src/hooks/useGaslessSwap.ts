/**
 * 0x Gasless Swap Hook
 * Ethereum mainnet only (chainId = 1)
 * 
 * Orchestrates quote generation, signing, and submission with auto-retry
 */

import { useState, useCallback } from 'react';
import { gaslessSwapV2Service } from '@/services/gaslessSwapV2';
import { GaslessQuote, Signatures } from '@/types/gasless';
import { useAuth } from '@/hooks/useAuth';
import { walletSigningService } from '@/services/walletSigningService';
import { getTokenDecimals } from '@/config/tokenAddresses';
import { ethers } from 'ethers';

interface GenerateQuoteParams {
  from: string;
  to: string;
  amount: string;
  slippage?: number;
}

interface ExecuteSwapParams {
  quote: GaslessQuote;
  password: string;
  userId: string;
  fromSymbol: string;
  toSymbol: string;
}

export const useGaslessSwap = () => {
  const { user } = useAuth();
  const [quote, setQuote] = useState<GaslessQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradeHash, setTradeHash] = useState<string | null>(null);

  /**
   * Generate a gasless quote
   */
  const generateQuote = useCallback(async (params: GenerateQuoteParams) => {
    if (!user) {
      throw new Error('User must be authenticated');
    }

    try {
      setLoading(true);
      setError(null);

      // Validate amount
      const amount = parseFloat(params.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
      }

      // Convert to wei/token units
      const decimals = getTokenDecimals(params.from);
      const sellAmount = ethers.parseUnits(params.amount, decimals).toString();

      // Get user's wallet address (derive from userId - deterministic)
      const tempWallet = await walletSigningService.getWalletForSigning(user.id, 'temp', 1);
      const userAddress = tempWallet.address;

      // Get quote from 0x
      const newQuote = await gaslessSwapV2Service.getQuote(
        params.from,
        params.to,
        sellAmount,
        userAddress
      );

      setQuote(newQuote);
      return newQuote;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to generate quote';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Execute swap with signatures and auto-retry on certain errors
   */
  const executeSwap = useCallback(async (params: ExecuteSwapParams) => {
    try {
      setLoading(true);
      setError(null);

      const { quote, password, userId, fromSymbol, toSymbol } = params;

      // Check if quote is expired
      const now = Math.floor(Date.now() / 1000);
      if (quote.expiry && now >= quote.expiry) {
        throw new Error('Quote expired. Please generate a new quote.');
      }

      // Sign EIP-712 payloads
      const signatures: Signatures = {
        trade: ''
      };

      // Sign approval if required
      if (quote.approval) {
        console.log('🔏 Signing approval permit...');
        const approvalSig = await walletSigningService.signTypedData(
          userId,
          password,
          quote.chainId,
          quote.approval.eip712.domain,
          quote.approval.eip712.types,
          quote.approval.eip712.message
        );
        signatures.approval = approvalSig;
      }

      // Sign trade
      console.log('🔏 Signing trade permit...');
      const tradeSig = await walletSigningService.signTypedData(
        userId,
        password,
        quote.chainId,
        quote.trade.eip712.domain,
        quote.trade.eip712.types,
        quote.trade.eip712.message
      );
      signatures.trade = tradeSig;

      // Submit to 0x
      const quoteId = `quote_${Date.now()}`;
      const intentId = `intent_${userId}_${Date.now()}`;

      console.log('📤 Submitting swap to 0x...');
      const result = await gaslessSwapV2Service.submitSwap(
        quote,
        signatures,
        quoteId,
        intentId
      );

      if (!result.success) {
        // Handle specific error types with auto-retry
        if (
          result.hint === 'requote_and_resign' ||
          result.error === 'gas_estimation_failed' ||
          result.error === 'stale_signature'
        ) {
          console.log('⚠️ Retrying with fresh quote...');
          
          // Get fresh quote
          const decimals = getTokenDecimals(fromSymbol);
          const sellAmount = ethers.parseUnits(
            ethers.formatUnits(quote.sellAmount, decimals),
            decimals
          ).toString();
          
          const tempWallet = await walletSigningService.getWalletForSigning(userId, 'temp', 1);
          const userAddress = tempWallet.address;
          const freshQuote = await gaslessSwapV2Service.getQuote(
            fromSymbol,
            toSymbol,
            sellAmount,
            userAddress
          );

          // Re-sign and re-submit
          return executeSwap({ quote: freshQuote, password, userId, fromSymbol, toSymbol });
        }

        // Non-recoverable error
        throw new Error(result.message || result.error || 'Swap failed');
      }

      if (result.tradeHash) {
        setTradeHash(result.tradeHash);
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Swap execution failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Clear current quote
   */
  const clearQuote = useCallback(() => {
    setQuote(null);
    setError(null);
    setTradeHash(null);
  }, []);

  return {
    quote,
    loading,
    error,
    tradeHash,
    generateQuote,
    executeSwap,
    clearQuote
  };
};
