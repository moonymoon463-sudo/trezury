import { useState, useCallback } from 'react';
import { secureWalletService, SecureWalletInfo } from '@/services/secureWalletService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface UseSecureWalletReturn {
  walletAddress: string | null;
  loading: boolean;
  createWallet: () => Promise<SecureWalletInfo | null>;
  validateAccess: () => Promise<boolean>;
  signTransaction: (transactionData: Record<string, unknown>) => Promise<string | null>;
  getWalletAddress: () => Promise<string | null>;
}

/**
 * Hook for secure wallet operations
 * Ensures private keys are never stored and always user-controlled
 */
export const useSecureWallet = (): UseSecureWalletReturn => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const createWallet = useCallback(async (): Promise<SecureWalletInfo | null> => {
    if (!user?.id) {
      return null;
    }

    try {
      setLoading(true);
      
      // Auto-generate wallet using just user ID - no password needed
      const walletInfo = await secureWalletService.generateDeterministicWallet(user.id);

      setWalletAddress(walletInfo.address);
      
      console.log('✅ Internal wallet automatically created');

      return walletInfo;
    } catch (error) {
      console.error('Auto wallet creation failed:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const validateAccess = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      return false;
    }

    try {
      setLoading(true);
      return await secureWalletService.validateWalletAccess(user.id);
    } catch (error) {
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const signTransaction = useCallback(async (
    transactionData: Record<string, unknown>
  ): Promise<string | null> => {
    if (!user?.id) {
      return null;
    }

    try {
      setLoading(true);
      
      // Auto-sign transaction using user ID
      const signedTx = await secureWalletService.signTransaction(
        user.id,
        transactionData
      );

      return signedTx;
    } catch (error) {
      console.error('Auto transaction signing failed:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getWalletAddress = useCallback(async (): Promise<string | null> => {
    if (!user?.id) {
      return null;
    }

    try {
      const address = await secureWalletService.getWalletAddress(user.id);
      setWalletAddress(address);
      return address;
    } catch (error) {
      return null;
    }
  }, [user]);

  return {
    walletAddress,
    loading,
    createWallet,
    validateAccess,
    signTransaction,
    getWalletAddress
  };
};