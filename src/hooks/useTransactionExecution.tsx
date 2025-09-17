import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";

export interface TransactionResult {
  success: boolean;
  transaction_id?: string;
  quote?: any;
  executed_at?: string;
  blockchain_hash?: string;
  confirmations?: number;
  error?: string;
}

export const useTransactionExecution = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeTransaction = async (quoteId: string, paymentMethod?: string): Promise<TransactionResult> => {
    try {
      setLoading(true);
      setError(null);

      // Execute via blockchain operations edge function for live transactions
      const { data: result, error } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'execute_transaction',
          quoteId: quoteId,
          paymentMethod: paymentMethod || 'wallet'
        }
      });

      if (error) {
        const errorMessage = error.message || 'Transaction execution failed';
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage
        };
      }

      // If blockchain operation succeeded, execute the database transaction
      const dbResult = await supabase.rpc('execute_transaction', {
        quote_id_param: quoteId,
        payment_method_param: paymentMethod || 'wallet'
      });

      if (dbResult.error) {
        console.error('Database transaction error:', dbResult.error);
        setError(dbResult.error.message || 'Transaction failed');
        return {
          success: false,
          error: dbResult.error.message || 'Transaction failed'
        };
      }

      // Combine blockchain and database results  
      const dbResultData = dbResult.data as any;
      const combinedResult: TransactionResult = {
        success: dbResultData?.success || false,
        transaction_id: dbResultData?.transaction_id,
        quote: dbResultData?.quote,
        executed_at: dbResultData?.executed_at,
        blockchain_hash: result?.hash,
        confirmations: result?.confirmations || 0,
        error: dbResultData?.error
      };
      
      if (!combinedResult.success) {
        setError(combinedResult.error || 'Transaction failed');
      }

      return combinedResult;
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