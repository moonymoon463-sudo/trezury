import { supabase } from "@/integrations/supabase/client";
import { securityMonitoringService } from "@/services/securityMonitoringService";

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
  chain: string;
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
        
        // Log security event for failed transaction
        await securityMonitoringService.logSecurityEvent({
          event_type: 'transaction_execution_failed',
          severity: 'medium',
          event_data: {
            quote_id: quoteId,
            payment_method: paymentMethod,
            error_message: error.message
          }
        });

        return {
          success: false,
          error: error.message || 'Failed to execute transaction'
        };
      }

      if (typeof data === 'object' && data !== null && 'success' in data) {
        const result = data as unknown as TransactionResult;
        
        // Monitor successful transactions for security
        if (result.success && result.transaction_id) {
          // Get transaction details for monitoring
          const transaction = await this.getTransaction(result.transaction_id);
          if (transaction) {
            await securityMonitoringService.monitorTransaction(
              transaction.id,
              transaction.quantity * (transaction.unit_price_usd || 0),
              transaction.asset
            );
          }
        }
        
        return result;
      }

      return {
        success: false,
        error: 'Invalid response format'
      };
    } catch (err) {
      console.error('Transaction service error:', err);
      
      // Log security event for unexpected errors
      await securityMonitoringService.logSecurityEvent({
        event_type: 'transaction_service_error',
        severity: 'high',
        event_data: {
          quote_id: quoteId,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      });

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return [];
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
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

  async recordTransaction({
    type,
    asset,
    quantity,
    unit_price_usd,
    fee_usd,
    status = 'completed',
    input_asset,
    output_asset,
    tx_hash,
    metadata = {},
    quote_id,
    chain = 'ethereum'
  }: {
    type: 'buy' | 'sell' | 'swap' | 'deposit' | 'withdrawal' | 'send' | 'receive' | 'fee';
    asset: string;
    quantity: number;
    unit_price_usd?: number;
    fee_usd?: number;
    status?: string;
    input_asset?: string;
    output_asset?: string;
    tx_hash?: string;
    metadata?: Record<string, any>;
    quote_id?: string;
    chain?: string;
  }): Promise<Transaction | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return null;
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          quote_id,
          type,
          asset,
          quantity,
          unit_price_usd,
          fee_usd,
          status,
          input_asset,
          output_asset,
          tx_hash,
          metadata,
          chain
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to record transaction:', error);
        return null;
      }

      return data as Transaction;
    } catch (err) {
      console.error('Record transaction service error:', err);
      return null;
    }
  }

  async getAllUserActivity(limit: number = 100): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return [];
      }

      // Get regular transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Get payment transactions (MoonPay, etc.)
      const { data: paymentTransactions } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Get balance snapshots to infer additional activity
      const { data: balanceSnapshots } = await supabase
        .from('balance_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_at', { ascending: false });

      // Combine and normalize all activity
      const allActivity = [
        ...(transactions || []).map(t => ({
          ...t,
          activity_type: 'transaction',
          timestamp: t.created_at
        })),
        ...(paymentTransactions || []).map(pt => ({
          ...pt,
          activity_type: 'payment',
          type: pt.provider === 'moonpay' ? 
            (pt.metadata as any)?.transaction_type || 'buy' : 'payment',
          timestamp: pt.created_at,
          asset: pt.currency,
          quantity: pt.amount
        })),
        ...(balanceSnapshots || []).map(bs => ({
          ...bs,
          activity_type: 'balance_change',
          type: bs.amount > 0 ? 'receive' : 'send',
          timestamp: bs.snapshot_at,
          asset: bs.asset,
          quantity: Math.abs(bs.amount)
        }))
      ];

      // Sort by timestamp and limit
      return allActivity
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (err) {
      console.error('Get all user activity error:', err);
      return [];
    }
  }
}

export const transactionService = new TransactionService();