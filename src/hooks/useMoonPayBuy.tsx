import { useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { secureWalletService } from '@/services/secureWalletService';
import { toast } from 'sonner';

interface MoonPayBuyRequest {
  amount: number;
  currency: string;
}

interface MoonPayBuyResponse {
  success: boolean;
  transactionId?: string;
  widgetUrl?: string;
  error?: string;
  requiresConfirmation?: boolean;
}

export const useMoonPayBuy = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const initiateBuy = async ({ amount, currency }: MoonPayBuyRequest): Promise<MoonPayBuyResponse> => {
    if (!user) {
      const errorMsg = 'Please sign in to continue with your purchase';
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      setLoading(true);
      setError(null);

      toast.loading('Setting up secure payment...', { id: 'moonpay-setup' });

      // Get user's wallet address
      const walletAddress = await secureWalletService.getWalletAddress(user.id);
      if (!walletAddress) {
        throw new Error('Unable to retrieve wallet address. Please ensure your wallet is set up.');
      }

      // Get auth token for the request
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Session expired. Please sign in again.');
      }

      // Call secure Edge Function proxy
      const { data, error } = await supabase.functions.invoke('moonpay-proxy', {
        body: {
          amount,
          currency,
          walletAddress,
          userId: user.id,
          returnUrl: `${window.location.origin}/moonpay-callback`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to initiate payment');
      }

      if (!data.success) {
        throw new Error(data.error || 'Payment initiation failed');
      }

      toast.dismiss('moonpay-setup');

      // Show confirmation if large transaction
      if (data.requiresConfirmation) {
        const confirmed = window.confirm(
          `⚠️ Large Transaction Confirmation\n\n` +
          `You are about to purchase $${amount.toFixed(2)} worth of crypto.\n\n` +
          `Daily remaining limit: $${data.limits?.daily_remaining?.toFixed(2) || 'N/A'}\n` +
          `Monthly remaining limit: $${data.limits?.monthly_remaining?.toFixed(2) || 'N/A'}\n\n` +
          `Do you want to proceed?`
        );

        if (!confirmed) {
          toast.info('Transaction cancelled');
          return { success: false, error: 'Transaction cancelled by user' };
        }
      }

      // Return widget URL for embedded dialog
      return {
        success: true,
        widgetUrl: data.widgetUrl,
        transactionId: data.transactionId || `moonpay_${Date.now()}`,
        requiresConfirmation: data.requiresConfirmation,
      };

    } catch (err) {
      toast.dismiss('moonpay-setup');
      
      let errorMessage = 'Failed to initiate payment';
      
      if (err instanceof Error) {
        errorMessage = err.message;
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