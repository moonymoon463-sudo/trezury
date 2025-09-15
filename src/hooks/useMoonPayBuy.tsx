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
      const errorMsg = 'Please sign in to continue with your purchase';
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Input validation
    if (!amount || amount <= 0) {
      const errorMsg = 'Please enter a valid amount';
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (amount < 10) {
      const errorMsg = 'Minimum purchase amount is $10';
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (amount > 10000) {
      const errorMsg = 'Maximum purchase amount is $10,000. Please contact support for larger amounts.';
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      setLoading(true);
      setError(null);

      console.log('Initiating MoonPay buy:', { amount, currency, userId: user.id });
      toast.loading('Setting up your payment...', { id: 'moonpay-setup' });

      const { data, error: functionError } = await supabase.functions.invoke('moonpay-buy', {
        body: {
          amount,
          currency,
          walletAddress: walletAddress || `user_${user.id}_wallet`,
          userId: user.id
        }
      });

      toast.dismiss('moonpay-setup');

      if (functionError) {
        console.error('MoonPay function error:', functionError);
        let errorMsg = 'Failed to initiate payment';
        
        // Provide more specific error messages
        if (functionError.message?.includes('KYC')) {
          errorMsg = 'Please complete identity verification before making a purchase';
        } else if (functionError.message?.includes('network')) {
          errorMsg = 'Network error. Please check your connection and try again';
        } else if (functionError.message?.includes('rate limit')) {
          errorMsg = 'Too many requests. Please wait a moment and try again';
        }
        
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (!data || !data.success) {
        console.error('MoonPay API error:', data?.error);
        let errorMsg = data?.error || 'Payment setup failed';
        
        // Handle specific MoonPay errors
        if (errorMsg.includes('INVALID_PARAMETERS')) {
          errorMsg = 'Invalid payment parameters. Please try again';
        } else if (errorMsg.includes('CURRENCY_NOT_SUPPORTED')) {
          errorMsg = 'This currency is not supported';
        } else if (errorMsg.includes('AMOUNT_TOO_SMALL')) {
          errorMsg = 'Amount is too small for this payment method';
        } else if (errorMsg.includes('AMOUNT_TOO_LARGE')) {
          errorMsg = 'Amount exceeds payment limits';
        }
        
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      console.log('MoonPay transaction created:', data.transactionId);
      toast.success('Redirecting to secure payment...', { duration: 2000 });

      return {
        success: true,
        transactionId: data.transactionId,
        redirectUrl: data.redirectUrl
      };

    } catch (err) {
      console.error('MoonPay buy error:', err);
      toast.dismiss('moonpay-setup');
      
      let errorMessage = 'Payment initiation failed';
      
      if (err instanceof Error) {
        if (err.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again';
        } else {
          errorMessage = err.message;
        }
      }
      
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