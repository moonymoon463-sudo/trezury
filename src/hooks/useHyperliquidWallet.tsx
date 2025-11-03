import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useHyperliquidWallet = (userId?: string) => {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWallet = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('hyperliquid_wallets')
          .select('address')
          .eq('user_id', userId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        setAddress(data?.address || null);
      } catch (err) {
        console.error('[useHyperliquidWallet] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load wallet');
      } finally {
        setLoading(false);
      }
    };

    loadWallet();
  }, [userId]);

  return { address, loading, error, hasWallet: !!address };
};
