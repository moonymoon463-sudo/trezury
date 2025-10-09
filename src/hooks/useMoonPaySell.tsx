import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { secureWalletService } from '@/services/secureWalletService';
import { toast } from 'sonner';

interface MoonPaySellRequest {
  amount: number;
  currency: string;
  returnUrl?: string;
  bankDetails?: {
    accountNumber: string;
    routingNumber: string;
    accountType: 'checking' | 'savings';
    bankName: string;
  };
}

interface MoonPaySellResponse {
  success: boolean;
  transactionId?: string;
  redirectUrl?: string;
  error?: string;
}

export const useMoonPaySell = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const initiateSell = async ({ amount, currency, returnUrl, bankDetails }: MoonPaySellRequest): Promise<MoonPaySellResponse> => {
    if (!user) {
      const errorMsg = 'User must be authenticated to sell crypto';
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (!amount || amount <= 0) {
      const errorMsg = 'Amount must be greater than 0';
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    setLoading(true);
    setError(null);

    try {
      // Get user's wallet address for prefilling
      const walletAddress = await secureWalletService.getWalletAddress(user.id);
      if (!walletAddress) {
        throw new Error('Unable to retrieve wallet address. Please ensure your wallet is set up.');
      }

      const { data, error: functionError } = await supabase.functions.invoke('moonpay-sell', {
        body: {
          amount,
          currency,
          returnUrl,
          bankDetails,
          userId: user.id,
          walletAddress
        }
      });

      if (functionError) {
        const errorMsg = functionError.message || 'Failed to initiate sell transaction';
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (!data.success) {
        const errorMsg = data.error || 'Sell transaction failed';
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      toast.success('Sell transaction initiated successfully');

      return {
        success: true,
        transactionId: data.transactionId,
        redirectUrl: data.redirectUrl
      };

    } catch (err) {
      const errorMsg = 'An unexpected error occurred during sell transaction';
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    initiateSell,
    loading,
    error
  };
};