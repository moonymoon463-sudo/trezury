import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  kyc_status: string;
  role: 'admin' | 'moderator' | 'user';
}

export interface AdminStats {
  total_users: number;
  verified_users: number;
  total_transactions: number;
  total_volume_usd: number;
  active_locks: number;
  total_locked_value: number;
  pending_kyc: number;
  recent_signups: number;
  total_fees_collected: number;
  fees_this_month: number;
  pending_fee_collections: number;
  fee_collection_rate: number;
}

export const useAdmin = () => {
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();

  // Check if current user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('is_admin');
        if (error) {
          setIsAdmin(false);
        } else {
          setIsAdmin(data || false);
        }
      } catch (error) {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  const getDashboardStats = async (): Promise<AdminStats | null> => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_dashboard_stats');
      
      if (error) {
        toast.error('Failed to fetch dashboard statistics');
        return null;
      }

      return data as unknown as AdminStats;
    } catch (error) {
      toast.error('Failed to fetch dashboard statistics');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getUsers = async (): Promise<AdminUser[]> => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return [];
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_users');
      
      if (error) {
        toast.error('Failed to fetch users');
        return [];
      }

      return data || [];
    } catch (error) {
      toast.error('Failed to fetch users');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const assignRole = async (userId: string, role: 'admin' | 'moderator' | 'user'): Promise<boolean> => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return false;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('admin_assign_role', {
        _user_id: userId,
        _role: role
      });
      
      if (error) {
        toast.error('Failed to assign role');
        return false;
      }

      toast.success(`Role ${role} assigned successfully`);
      return true;
    } catch (error) {
      toast.error('Failed to assign role');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeRole = async (userId: string, role: 'admin' | 'moderator' | 'user'): Promise<boolean> => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return false;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('admin_remove_role', {
        _user_id: userId,
        _role: role
      });
      
      if (error) {
        toast.error('Failed to remove role');
        return false;
      }

      toast.success(`Role ${role} removed successfully`);
      return true;
    } catch (error) {
      toast.error('Failed to remove role');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getTransactions = async (limit = 50) => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return [];
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          profiles!transactions_user_id_fkey(email)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        toast.error('Failed to fetch transactions');
        return [];
      }

      return data || [];
    } catch (error) {
      toast.error('Failed to fetch transactions');
      return [];
    } finally {
      setLoading(false);
    }
  };


  const getFeeAnalytics = async (startDate?: string, endDate?: string) => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_fee_analytics_with_chains', {
        start_date: startDate,
        end_date: endDate
      });
      
      if (error) {
        toast.error('Failed to fetch fee analytics');
        return null;
      }

      return data;
    } catch (error) {
      toast.error('Failed to fetch fee analytics');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    isAdmin,
    loading,
    getDashboardStats,
    getUsers,
    assignRole,
    removeRole,
    getTransactions,
    getFeeAnalytics
  };
};