import { useState, useCallback, useRef } from 'react';
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
  
  // Request sequencing to prevent stale quotes from overwriting newer ones
  const currentRequestIdRef = useRef(0);

  const getQuote = useCallback(async (request: BridgeQuoteRequest) => {
    setLoading(true);
    setError(null);
    
    // Increment request ID for this quote request
    const requestId = ++currentRequestIdRef.current;
    console.log(`[Bridge] Quote request #${requestId} for amount:`, request.amount);
    
    try {
      const quoteData = await hyperliquidBridgeService.getQuote(request);
      
      // Only update state if this is still the latest request
      if (requestId === currentRequestIdRef.current) {
        console.log(`[Bridge] Quote set for amount: ${quoteData.inputAmount} → ${quoteData.estimatedOutput}`);
        setQuote(quoteData);
      } else {
        console.log(`[Bridge] Discarding stale quote #${requestId} (current: #${currentRequestIdRef.current})`);
      }
    } catch (err) {
      // Only update error if this is still the latest request
      if (requestId === currentRequestIdRef.current) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to get quote';
        setError(errorMsg);
        console.error('[useHyperliquidBridge] Quote error:', err);
      }
    } finally {
      if (requestId === currentRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const executeBridge = useCallback(async (
    quoteData: BridgeQuote,
    sourceWalletAddress?: string,
    sourceWalletType: 'internal' | 'external' = 'external',
    password?: string
  ) => {
    if (!user?.id) throw new Error('User not authenticated');
    if (!sourceWalletAddress) throw new Error('Source wallet address required');

    console.log('[useHyperliquidBridge] Starting bridge execution:', {
      amount: quoteData.inputAmount,
      provider: quoteData.provider,
      sourceWalletType,
      sourceWalletAddress: sourceWalletAddress?.slice(0, 10) + '...'
    });

    setLoading(true);
    setError(null);
    try {
      const result = await hyperliquidBridgeService.executeBridge(
        user.id,
        quoteData,
        sourceWalletAddress,
        sourceWalletType,
        password
      );

      console.log('[useHyperliquidBridge] Bridge result:', result);

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
      console.error('[useHyperliquidBridge] Bridge error:', err);
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
