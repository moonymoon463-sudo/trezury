import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface MoonPayRecurringRequest {
  amount: number;
  currency: string;
  assetSymbol: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  returnUrl?: string;
}

interface MoonPayRecurringResponse {
  success: boolean;
  transactionId?: string;
  redirectUrl?: string;
  error?: string;
}

interface RecurringTransaction {
  id: number;
  moonpay_tx_id: string | null;
  asset_symbol: string;
  amount_fiat: number | null;
  currency_fiat: string | null;
  amount_crypto: number | null;
  status: string;
  recurring_frequency: string | null;
  created_at: string;
  updated_at: string;
}

export const useMoonPayRecurring = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const buildMoonPayUrl = useCallback((params: MoonPayRecurringRequest): string => {
    if (!user) throw new Error('User not authenticated');

    const moonpayKey = import.meta.env.VITE_MOONPAY_PUBLISHABLE_KEY;
    if (!moonpayKey) {
      throw new Error('MoonPay API key not configured');
    }

    const baseUrl = 'https://buy.moonpay.com';
    const urlParams = new URLSearchParams({
      apiKey: moonpayKey,
      baseCurrencyCode: params.currency.toLowerCase(),
      baseCurrencyAmount: params.amount.toString(),
      currencyCode: params.assetSymbol.toLowerCase(),
      externalCustomerId: user.id,
      email: user.email || '',
      theme: 'dark',
      showOnlyCurrencies: params.assetSymbol.toLowerCase(),
      redirectURL: params.returnUrl || window.location.origin + '/moonpay/callback',
      lockAmount: 'true',
      ...(params.returnUrl && { returnUrl: params.returnUrl })
    });

    return `${baseUrl}?${urlParams.toString()}`;
  }, [user]);

  const initiateRecurringBuy = async (params: MoonPayRecurringRequest): Promise<MoonPayRecurringResponse> => {
    if (!user) {
      const errorMsg = 'User must be authenticated to set up recurring buys';
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (!params.amount || params.amount <= 0) {
      const errorMsg = 'Amount must be greater than 0';
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (params.amount < 10) {
      const errorMsg = 'Minimum amount for recurring buys is $10';
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Setting up recurring buy:', { 
        amount: params.amount, 
        currency: params.currency,
        asset: params.assetSymbol,
        frequency: params.frequency,
        userId: user.id 
      });

      // Create customer record if it doesn't exist
      const { error: customerError } = await supabase
        .from('moonpay_customers')
        .upsert({
          user_id: user.id,
          email: user.email || '',
          country_code: 'GB', // Default to GB as per requirements
          kyc_status: 'unknown'
        }, {
          onConflict: 'user_id'
        });

      if (customerError) {
        console.error('Failed to create/update customer record:', customerError);
        throw new Error('Failed to prepare recurring buy setup');
      }

      // Create initial transaction record
      const { data: transactionData, error: transactionError } = await supabase
        .from('moonpay_transactions')
        .insert({
          user_id: user.id,
          asset_symbol: params.assetSymbol,
          amount_fiat: params.amount,
          currency_fiat: params.currency,
          status: 'initiated',
          is_recurring: true,
          recurring_frequency: params.frequency
        })
        .select()
        .single();

      if (transactionError) {
        console.error('Failed to create transaction record:', transactionError);
        throw new Error('Failed to initialize recurring buy');
      }

      // Build MoonPay URL
      const redirectUrl = buildMoonPayUrl(params);

      console.log('Recurring buy initiated successfully:', {
        transactionId: transactionData.id,
        redirectUrl
      });

      toast.success('Redirecting to MoonPay to set up recurring buy...');

      return {
        success: true,
        transactionId: transactionData.id.toString(),
        redirectUrl
      };

    } catch (err) {
      console.error('Unexpected error during recurring buy setup:', err);
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const getRecurringTransactions = useCallback(async (): Promise<RecurringTransaction[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('moonpay_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_recurring', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch recurring transactions:', error);
        throw error;
      }

      return data || [];
    } catch (err) {
      console.error('Error fetching recurring transactions:', err);
      setError('Failed to load recurring transaction history');
      return [];
    }
  }, [user]);

  const getMoonPayManageUrl = useCallback((): string => {
    return 'https://buy.moonpay.com/accounts/dashboard';
  }, []);

  return {
    initiateRecurringBuy,
    getRecurringTransactions,
    getMoonPayManageUrl,
    buildMoonPayUrl,
    loading,
    error
  };
};