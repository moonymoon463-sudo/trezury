import { useState } from 'react';
import { swapService, SwapResult } from '@/services/swapService';

export interface SwapExecutionOptions {
  useGasless?: boolean;
  gaslessMode?: 'syncfee' | 'sponsored';
}

export const useSwapExecution = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gelatoTaskId, setGelatoTaskId] = useState<string | null>(null);

  const executeSwap = async (
    quoteId: string, 
    userId: string, 
    walletPassword: string,
    options?: SwapExecutionOptions
  ): Promise<SwapResult> => {
    try {
      setLoading(true);
      setError(null);

      // Pass gasless option to swap service
      const result = await swapService.executeSwap(
        quoteId, 
        userId, 
        walletPassword, 
        options?.useGasless || false
      );
      
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
    error,
    gelatoTaskId
  };
};