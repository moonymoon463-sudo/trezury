import { useState } from 'react';
import { swapService, SwapResult } from '@/services/swapService';

export const useSwapExecution = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeSwap = async (quoteId: string, userId: string, walletPassword: string): Promise<SwapResult> => {
    try {
      setLoading(true);
      setError(null);

      const result = await swapService.executeSwap(quoteId, userId, walletPassword);
      
      if (!result.success) {
        setError(result.error || 'Swap execution failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Swap execution failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    executeSwap,
    loading,
    error
  };
};