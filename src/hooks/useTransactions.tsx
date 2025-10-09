import { useState, useEffect } from 'react';
import { transactionService, Transaction } from '@/services/transactionService';
import { useAuth } from './useAuth';

export const useTransactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!user) {
      setTransactions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await transactionService.getUserTransactions();
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const getTransaction = async (transactionId: string): Promise<Transaction | null> => {
    try {
      return await transactionService.getTransaction(transactionId);
    } catch (err) {
      return null;
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  return {
    transactions,
    loading,
    error,
    fetchTransactions,
    getTransaction
  };
};