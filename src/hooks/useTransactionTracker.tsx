import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { transactionService } from '@/services/transactionService';

export interface ActivityRecord {
  id: string;
  activity_type: 'transaction' | 'payment' | 'balance_change';
  type: string;
  asset: string;
  quantity: number;
  status?: string;
  tx_hash?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  unit_price_usd?: number;
  fee_usd?: number;
  input_asset?: string;
  output_asset?: string;
}

export const useTransactionTracker = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllActivity = useCallback(async () => {
    if (!user) {
      setActivities([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const activity = await transactionService.getAllUserActivity();
      setActivities(activity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch activity');
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const recordExternalActivity = useCallback(async ({
    type,
    asset,
    quantity,
    tx_hash,
    from_address,
    to_address,
    unit_price_usd,
    fee_usd
  }: {
    type: 'send' | 'receive' | 'deposit' | 'withdrawal';
    asset: string;
    quantity: number;
    tx_hash?: string;
    from_address?: string;
    to_address?: string;
    unit_price_usd?: number;
    fee_usd?: number;
  }) => {
    try {
      const transaction = await transactionService.recordTransaction({
        type,
        asset,
        quantity,
        unit_price_usd,
        fee_usd,
        tx_hash,
        metadata: {
          from_address,
          to_address,
          transaction_source: 'external_wallet',
          detected_via: 'blockchain_monitoring'
        }
      });

      if (transaction) {
        // Also create balance snapshot
        await supabase
          .from('balance_snapshots')
          .insert({
            user_id: user?.id,
            asset,
            amount: type === 'receive' || type === 'deposit' ? quantity : -quantity,
            snapshot_at: new Date().toISOString()
          });

        // Refresh activity list
        fetchAllActivity();
      }

      return transaction;
    } catch (err) {
      console.error('Failed to record external activity:', err);
      return null;
    }
  }, [user, fetchAllActivity]);

  // Set up real-time subscriptions for all transaction-related tables
  useEffect(() => {
    if (!user) return;

    const channels = [
      // Subscribe to transactions table
      supabase
        .channel('transactions-channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${user.id}`
          },
          () => fetchAllActivity()
        )
        .subscribe(),

      // Subscribe to payment transactions
      supabase
        .channel('payment-transactions-channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payment_transactions',
            filter: `user_id=eq.${user.id}`
          },
          () => fetchAllActivity()
        )
        .subscribe(),

      // Subscribe to balance snapshots
      supabase
        .channel('balance-snapshots-channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'balance_snapshots',
            filter: `user_id=eq.${user.id}`
          },
          () => fetchAllActivity()
        )
        .subscribe()
    ];

    // Initial fetch
    fetchAllActivity();

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [user, fetchAllActivity]);

  const getActivityIcon = useCallback((activity: ActivityRecord) => {
    switch (activity.type) {
      case 'buy': return '🛒';
      case 'sell': return '💰';
      case 'swap': return '🔄';
      case 'send': return '📤';
      case 'receive': return '📥';
      case 'deposit': return '⬇️';
      case 'withdrawal': return '⬆️';
      case 'fee': return '💸';
      default: return '📊';
    }
  }, []);

  const getActivityDescription = useCallback((activity: ActivityRecord) => {
    const action = activity.type.charAt(0).toUpperCase() + activity.type.slice(1);
    const amount = activity.quantity.toFixed(activity.asset === 'USDC' ? 2 : 6);
    const asset = activity.asset;

    switch (activity.type) {
      case 'buy':
        return `${action} ${amount} ${asset}${activity.metadata?.provider ? ` via ${activity.metadata.provider}` : ''}`;
      case 'sell':
        return `${action} ${amount} ${asset}${activity.metadata?.provider ? ` via ${activity.metadata.provider}` : ''}`;
      case 'swap':
        return `Swap ${activity.input_asset} → ${activity.output_asset}`;
      case 'send':
        return `Send ${amount} ${asset}`;
      case 'receive':
        return `Receive ${amount} ${asset}`;
      case 'deposit':
        return `Deposit ${amount} ${asset}`;
      case 'withdrawal':
        return `Withdraw ${amount} ${asset}`;
      default:
        return `${action} ${amount} ${asset}`;
    }
  }, []);

  return {
    activities,
    loading,
    error,
    fetchAllActivity,
    recordExternalActivity,
    getActivityIcon,
    getActivityDescription
  };
};