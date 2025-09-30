import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface TransactionLimits {
  tier: string;
  single_max: number;
  daily_remaining: number;
  monthly_remaining: number;
}

interface VelocityCheckResult {
  allowed: boolean;
  requires_confirmation?: boolean;
  reason?: string;
  limit?: number;
  current?: number;
  requested?: number;
  limits?: TransactionLimits;
}

export const useTransactionLimits = () => {
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);

  const checkTransactionVelocity = async (
    amount: number
  ): Promise<VelocityCheckResult> => {
    if (!user) {
      return {
        allowed: false,
        reason: 'User not authenticated',
      };
    }

    try {
      setChecking(true);

      const { data, error } = await supabase.rpc('check_transaction_velocity', {
        p_user_id: user.id,
        p_amount: amount,
      });

      if (error) {
        console.error('Velocity check error:', error);
        toast.error('Failed to validate transaction limits');
        return {
          allowed: false,
          reason: 'Failed to check transaction limits',
        };
      }

      const result = (data as unknown) as VelocityCheckResult;

      // Show appropriate messages
      if (!result.allowed) {
        let message = 'Transaction not allowed';
        
        switch (result.reason) {
          case 'single_transaction_limit_exceeded':
            message = `Transaction amount ($${amount.toFixed(2)}) exceeds your single transaction limit of $${result.limit?.toFixed(2)}`;
            break;
          case 'hourly_velocity_exceeded':
            message = `You've reached your hourly transaction limit (${result.limit} transactions)`;
            break;
          case 'daily_velocity_exceeded':
            message = `You've reached your daily transaction limit (${result.limit} transactions)`;
            break;
          case 'daily_amount_exceeded':
            message = `This transaction would exceed your daily limit of $${result.limit?.toFixed(2)}`;
            break;
          case 'monthly_amount_exceeded':
            message = `This transaction would exceed your monthly limit of $${result.limit?.toFixed(2)}`;
            break;
        }
        
        toast.error(message);
      } else if (result.requires_confirmation) {
        toast.warning(
          `Large transaction detected ($${amount.toFixed(2)}). Please confirm to proceed.`,
          { duration: 5000 }
        );
      }

      return result;
    } catch (err) {
      console.error('Transaction velocity check failed:', err);
      toast.error('Failed to validate transaction');
      return {
        allowed: false,
        reason: 'Validation failed',
      };
    } finally {
      setChecking(false);
    }
  };

  return {
    checkTransactionVelocity,
    checking,
  };
};
