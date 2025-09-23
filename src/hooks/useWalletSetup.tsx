import { useState } from 'react';
import { useAuth } from './useAuth';
import { secureWalletService } from '@/services/secureWalletService';
import { supabase } from '@/integrations/supabase/client';

export const useWalletSetup = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupWallet = async (userPassword?: string) => {
    if (!user) {
      setError('User must be authenticated');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // Get wallet address - this will create one if it doesn't exist
      const walletAddress = await secureWalletService.getWalletAddress(user.id);
      
      if (!walletAddress) {
        throw new Error('Failed to create wallet address');
      }

      console.log(`Unique wallet setup for user ${user.id}: ${walletAddress}`);
      
      return {
        address: walletAddress
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to setup wallet';
      setError(errorMessage);
      console.error('Wallet setup failed:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const checkWalletExists = async () => {
    if (!user) return false;

    try {
      const address = await secureWalletService.getWalletAddress(user.id);
      return !!address;
    } catch {
      return false;
    }
  };

  return {
    setupWallet,
    checkWalletExists,
    loading,
    error
  };
};