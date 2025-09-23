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

      // Execute database transaction first to validate quote and generate transaction record
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

      const dbResultData = dbResult.data as any;
      if (!dbResultData?.success) {
        setError(dbResultData?.error || 'Transaction validation failed');
        return {
          success: false,
          error: dbResultData?.error || 'Transaction validation failed'
        };
      }

      // Now execute the actual blockchain transaction
      const { data: blockchainResult, error: blockchainError } = await supabase.functions.invoke('blockchain-operations', {
        body: {
          operation: 'execute_transaction',
          quoteId: quoteId,
          paymentMethod: paymentMethod || 'wallet'
        }
      });

      if (blockchainError || !blockchainResult?.success) {
        const errorMessage = blockchainResult?.error || blockchainError?.message || 'Blockchain transaction failed';
        setError(errorMessage);
        
        // Update transaction status to failed
        if (dbResultData?.transaction_id) {
          await supabase
            .from('transactions')
            .update({ 
              status: 'failed',
              metadata: {
                ...(dbResultData.metadata || {}),
                blockchain_error: errorMessage,
                failed_at: new Date().toISOString()
              }
            })
            .eq('id', dbResultData.transaction_id);
        }
        
        return {
          success: false,
          error: errorMessage
        };
      }

      // Update transaction with blockchain results
      if (dbResultData?.transaction_id && blockchainResult?.hash) {
        await supabase
          .from('transactions')
          .update({ 
            tx_hash: blockchainResult.hash,
            status: 'completed',
            metadata: {
              ...(dbResultData.metadata || {}),
              blockchain_hash: blockchainResult.hash,
              block_number: blockchainResult.blockNumber,
              gas_used: blockchainResult.gasUsed,
              confirmations: blockchainResult.confirmations || 1,
              completed_at: new Date().toISOString()
            }
          })
          .eq('id', dbResultData.transaction_id);
      }

      // Combine database and blockchain results
      const combinedResult: TransactionResult = {
        success: true,
        transaction_id: dbResultData?.transaction_id,
        quote: dbResultData?.quote,
        executed_at: dbResultData?.executed_at,
        blockchain_hash: blockchainResult?.hash,
        confirmations: blockchainResult?.confirmations || 1,
        error: null
      };

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