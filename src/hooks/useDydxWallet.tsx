import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { dydxWalletService } from '@/services/dydxWalletService';

export const useDydxWallet = () => {
  const { user } = useAuth();
  const [hasDydxWallet, setHasDydxWallet] = useState(false);
  const [dydxAddress, setDydxAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadWalletStatus();
    } else {
      setHasDydxWallet(false);
      setDydxAddress(null);
      setLoading(false);
    }
  }, [user]);

  const loadWalletStatus = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const hasWallet = await dydxWalletService.hasWallet(user.id);
      setHasDydxWallet(hasWallet);

      if (hasWallet) {
        const address = await dydxWalletService.getDydxAddress(user.id);
        setDydxAddress(address);
      }
    } catch (error) {
      console.error('Error loading dYdX wallet status:', error);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    return loadWalletStatus();
  };

  return {
    hasDydxWallet,
    dydxAddress,
    loading,
    refresh
  };
};
