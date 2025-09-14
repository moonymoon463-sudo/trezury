import { supabase } from "@/integrations/supabase/client";

export interface TransactionResult {
  success: boolean;
  transaction_id?: string;
  quote?: any;
  executed_at?: string;
  error?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  quote_id?: string;
  type: string;
  asset: string;
  quantity: number;
  unit_price_usd?: number;
  fee_usd?: number;
  status: string;
  input_asset?: string;
  output_asset?: string;
  tx_hash?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

class TransactionService {
  async executeTransaction(quoteId: string, paymentMethod?: string): Promise<TransactionResult> {
    try {
      const { data, error } = await supabase.rpc('execute_transaction', {
        quote_id_param: quoteId,
        payment_method_param: paymentMethod || 'wallet'
      });

      if (error) {
        console.error('Transaction execution error:', error);
        return {
          success: false,
          error: error.message || 'Failed to execute transaction'
        };
      }

      if (typeof data === 'object' && data !== null && 'success' in data) {
        return data as unknown as TransactionResult;
      }

      return {
        success: false,
        error: 'Invalid response format'
      };
    } catch (err) {
      console.error('Transaction service error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred'
      };
    }
  }

  async getTransaction(transactionId: string): Promise<Transaction | null> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error) {
        console.error('Get transaction error:', error);
        return null;
      }

      return data as Transaction;
    } catch (err) {
      console.error('Get transaction service error:', err);
      return null;
    }
  }

  async getUserTransactions(limit: number = 50): Promise<Transaction[]> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Get user transactions error:', error);
        return [];
      }

      return (data || []) as Transaction[];
    } catch (err) {
      console.error('Get user transactions service error:', err);
      return [];
    }
  }
}

export const transactionService = new TransactionService();