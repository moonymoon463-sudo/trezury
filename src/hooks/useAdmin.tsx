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
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data || false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
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
        console.error('Error fetching dashboard stats:', error);
        toast.error('Failed to fetch dashboard statistics');
        return null;
      }

      return data as unknown as AdminStats;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
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
        console.error('Error fetching users:', error);
        toast.error('Failed to fetch users');
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching users:', error);
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
        console.error('Error assigning role:', error);
        toast.error('Failed to assign role');
        return false;
      }

      toast.success(`Role ${role} assigned successfully`);
      return true;
    } catch (error) {
      console.error('Error assigning role:', error);
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
        console.error('Error removing role:', error);
        toast.error('Failed to remove role');
        return false;
      }

      toast.success(`Role ${role} removed successfully`);
      return true;
    } catch (error) {
      console.error('Error removing role:', error);
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
        console.error('Error fetching transactions:', error);
        toast.error('Failed to fetch transactions');
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to fetch transactions');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getKYCSubmissions = async () => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return [];
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, kyc_status, kyc_submitted_at, kyc_verified_at, kyc_rejection_reason')
        .in('kyc_status', ['pending', 'under_review', 'verified', 'rejected'])
        .order('kyc_submitted_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching KYC submissions:', error);
        toast.error('Failed to fetch KYC submissions');
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching KYC submissions:', error);
      toast.error('Failed to fetch KYC submissions');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateKYCStatus = async (userId: string, status: string, rejectionReason?: string): Promise<boolean> => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return false;
    }

    setLoading(true);
    try {
      const updateData: any = {
        kyc_status: status,
      };

      if (status === 'verified') {
        updateData.kyc_verified_at = new Date().toISOString();
      }

      if (status === 'rejected' && rejectionReason) {
        updateData.kyc_rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);
      
      if (error) {
        console.error('Error updating KYC status:', error);
        toast.error('Failed to update KYC status');
        return false;
      }

      toast.success(`KYC status updated to ${status}`);
      return true;
    } catch (error) {
      console.error('Error updating KYC status:', error);
      toast.error('Failed to update KYC status');
      return false;
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
    getKYCSubmissions,
    updateKYCStatus
  };
};