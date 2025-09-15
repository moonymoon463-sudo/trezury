import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Json } from '@/integrations/supabase/types';

export interface PaymentTransaction {
  id: string;
  user_id: string;
  provider: string;
  external_id: string;
  amount: number;
  currency: string;
  status: string;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export const usePaymentStatus = (transactionId?: string) => {
  const { user } = useAuth();
  const [transaction, setTransaction] = useState<PaymentTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransaction = async (id: string) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('external_id', id)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('Failed to fetch payment transaction:', fetchError);
        setError('Failed to fetch transaction status');
        return;
      }

      setTransaction(data);
    } catch (err) {
      console.error('Payment status error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch payment status');
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async (id: string) => {
    await fetchTransaction(id);
  };

  // Set up real-time subscription for payment updates
  useEffect(() => {
    if (!user || !transactionId) return;

    const channel = supabase
      .channel('payment-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_transactions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedTransaction = payload.new as PaymentTransaction;
          if (updatedTransaction.external_id === transactionId) {
            setTransaction(updatedTransaction);
          }
        }
      )
      .subscribe();

    // Initial fetch
    fetchTransaction(transactionId);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, transactionId]);

  return {
    transaction,
    loading,
    error,
    checkPaymentStatus,
    refetch: () => transactionId ? fetchTransaction(transactionId) : null
  };
};