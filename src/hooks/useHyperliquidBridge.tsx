import { useState, useCallback } from 'react';
import { hyperliquidBridgeService, BridgeQuoteRequest, BridgeQuote } from '@/services/hyperliquidBridgeService';
import { useAuth } from '@/hooks/useAuth';

export const useHyperliquidBridge = () => {
  const { user } = useAuth();
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<{
    bridgeId?: string;
    txHash?: string;
    status?: string;
    amount?: number;
  } | null>(null);

  const getQuote = useCallback(async (request: BridgeQuoteRequest) => {
    setLoading(true);
    setError(null);
    try {
      const quoteData = await hyperliquidBridgeService.getQuote(request);
      setQuote(quoteData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get quote';
      setError(errorMsg);
      console.error('[useHyperliquidBridge] Quote error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const executeBridge = useCallback(async (
    quoteData: BridgeQuote,
    sourceWalletAddress?: string
  ) => {
    if (!user?.id) throw new Error('User not authenticated');
    if (!sourceWalletAddress) throw new Error('Source wallet address required');

    setLoading(true);
    setError(null);
    try {
      const result = await hyperliquidBridgeService.executeBridge(
        user.id,
        quoteData,
        sourceWalletAddress
      );

      if (!result.success) {
        throw new Error(result.error || 'Bridge execution failed');
      }

      setBridgeStatus({
        bridgeId: result.bridgeId,
        txHash: result.txHash,
        status: 'processing',
        amount: quoteData.inputAmount
      });

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to execute bridge';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const checkStatus = useCallback(async (bridgeId: string) => {
    try {
      const status = await hyperliquidBridgeService.checkBridgeStatus(bridgeId);
      setBridgeStatus(prev => ({
        ...prev,
        status: status.status,
        txHash: status.txHash || prev?.txHash
      }));
      return status;
    } catch (err) {
      console.error('[useHyperliquidBridge] Status check error:', err);
      throw err;
    }
  }, []);

  return {
    quote,
    loading,
    error,
    bridgeStatus,
    getQuote,
    executeBridge,
    checkStatus
  };
};
