import { useState } from 'react';
import { swapService, SwapResult, SwapQuote } from '@/services/swapService';

export interface SwapExecutionOptions {
  useGasless?: boolean; // Always true now with 0x Gasless API
}

export const useSwapExecution = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gelatoTaskId, setGelatoTaskId] = useState<string | null>(null);

  const executeSwap = async (
    quote: SwapQuote, 
    userId: string, 
    walletPassword: string,
    options?: SwapExecutionOptions
  ): Promise<SwapResult> => {
    try {
      setLoading(true);
      setError(null);

      // 0x Gasless API is now default (always gasless)
      const result = await swapService.executeSwap(
        quote, 
        userId, 
        walletPassword, 
        true // Always use gasless with 0x Gasless API
      );
      
      if (!result.success) {
        setError(result.error || 'Swap execution failed');
      }

      if (result.gelatoTaskId) {
        setGelatoTaskId(result.gelatoTaskId);
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
    error,
    gelatoTaskId
  };
};