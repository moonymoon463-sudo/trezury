import { useState } from 'react';
import { transactionService, TransactionResult } from '@/services/transactionService';

export const useTransactionExecution = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeTransaction = async (quoteId: string, paymentMethod?: string): Promise<TransactionResult> => {
    try {
      setLoading(true);
      setError(null);

      const result = await transactionService.executeTransaction(quoteId, paymentMethod);
      
      if (!result.success) {
        setError(result.error || 'Transaction failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transaction execution failed';
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
    executeTransaction,
    loading,
    error
  };
};