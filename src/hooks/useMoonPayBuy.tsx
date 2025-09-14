import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface MoonPayBuyRequest {
  amount: number;
  currency: string;
  walletAddress?: string;
}

interface MoonPayBuyResponse {
  success: boolean;
  transactionId?: string;
  redirectUrl?: string;
  error?: string;
}

export const useMoonPayBuy = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const initiateBuy = async ({ amount, currency, walletAddress }: MoonPayBuyRequest): Promise<MoonPayBuyResponse> => {
    if (!user) {
      const errorMsg = 'User not authenticated';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      setLoading(true);
      setError(null);

      console.log('Initiating MoonPay buy:', { amount, currency, userId: user.id });

      const { data, error: functionError } = await supabase.functions.invoke('moonpay-buy', {
        body: {
          amount,
          currency,
          walletAddress: walletAddress || `user_${user.id}_wallet`,
          userId: user.id
        }
      });

      if (functionError) {
        console.error('MoonPay function error:', functionError);
        const errorMsg = 'Failed to initiate payment';
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (!data.success) {
        console.error('MoonPay API error:', data.error);
        setError(data.error);
        toast.error(data.error);
        return { success: false, error: data.error };
      }

      console.log('MoonPay transaction created:', data.transactionId);
      toast.success('Payment initiated successfully');

      return {
        success: true,
        transactionId: data.transactionId,
        redirectUrl: data.redirectUrl
      };

    } catch (err) {
      console.error('MoonPay buy error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Payment initiation failed';
      setError(errorMessage);
      toast.error(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    initiateBuy,
    loading,
    error
  };
};