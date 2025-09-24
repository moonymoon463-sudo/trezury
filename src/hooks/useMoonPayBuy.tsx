import { useState } from 'react';
import { loadMoonPay } from '@moonpay/moonpay-js';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface MoonPayBuyRequest {
  amount: number;
  currency: string;
}

interface MoonPayBuyResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
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

      console.log('Initiating MoonPay buy with SDK:', { amount, currency, userId: user.id });
      toast.loading('Setting up payment widget...', { id: 'moonpay-setup' });

      // Load and initialize MoonPay SDK
      const moonPay = await loadMoonPay();
      const moonPaySdk = moonPay({
        flow: 'buy',
        environment: 'sandbox',
        variant: 'overlay',
        params: {
          apiKey: 'pk_test_hnzbkKKRwR5ksg8cbLVafnA1Pv05YH46',
          theme: 'dark',
          baseCurrencyCode: currency.toLowerCase(),
          baseCurrencyAmount: amount.toString(),
          defaultCurrencyCode: 'usdc'
        },
        handlers: {
          onTransactionCompleted: async (data: any) => {
            console.log('MoonPay transaction completed:', data);
            toast.success('Purchase completed successfully!');
            setLoading(false);
          },
          onCloseOverlay: async () => {
            console.log('MoonPay widget closed');
            toast.dismiss('moonpay-setup');
            setLoading(false);
          }
        }
      });

      toast.dismiss('moonpay-setup');
      
      // Show the widget
      moonPaySdk.show();

      return {
        success: true,
        transactionId: `moonpay_${Date.now()}`
      };

    } catch (err) {
      console.error('MoonPay SDK error:', err);
      toast.dismiss('moonpay-setup');
      
      let errorMessage = 'Failed to load payment widget';
      
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