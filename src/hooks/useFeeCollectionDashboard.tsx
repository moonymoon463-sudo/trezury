import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PendingFeeRequest {
  id: string;
  amount: number;
  asset: string;
  from_address: string;
  chain: string;
  created_at: string;
  transaction_id: string;
}

export interface BatchHistoryEntry {
  date: string;
  completed_count: number;
  failed_count: number;
  total_amount: number;
  success_rate: number;
  chain: string;
}

export interface FeeCollectionDashboardStats {
  pending_count: number;
  pending_amount: number;
  success_rate_24h: number;
  success_rate_7d: number;
  last_collection: {
    completed_at: string;
    amount: number;
    asset: string;
    chain: string;
  } | null;
  avg_collection_time_seconds: number;
  failed_count: number;
  failed_amount: number;
  batch_history: BatchHistoryEntry[];
  pending_requests: PendingFeeRequest[];
  asset_breakdown: Record<string, number>;
}

export const useFeeCollectionDashboard = () => {
  const [stats, setStats] = useState<FeeCollectionDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDashboardData = async () => {
    try {
      const { data, error } = await supabase.rpc('admin_get_fee_collection_dashboard_stats');

      if (error) throw error;

      setStats(data as unknown as FeeCollectionDashboardStats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast({
        variant: 'destructive',
        title: 'Error Loading Dashboard',
        description: 'Failed to load fee collection dashboard data',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to real-time updates on fee_collection_requests
    const channel = supabase
      .channel('fee-collection-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fee_collection_requests',
        },
        () => {
          // Refresh data when fee collection requests change
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    stats,
    loading,
    refresh: fetchDashboardData,
  };
};
