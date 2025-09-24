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
  revealPrivateKey: (userPassword?: string) => Promise<string | null>;
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
      
      // First check if wallet already exists
      const existingAddress = await secureWalletService.getWalletAddress(user.id);
      if (existingAddress) {
        console.log('✅ Using existing internal wallet:', existingAddress);
        setWalletAddress(existingAddress);
        return { address: existingAddress, publicKey: '' };
      }
      
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
    transactionData: Record<string, unknown>,
    userPassword?: string
  ): Promise<string | null> => {
    if (!user?.id) {
      return null;
    }

    try {
      setLoading(true);
      
      // Sign transaction using user's unique wallet
      const signedTx = await secureWalletService.signTransaction(
        user.id,
        transactionData,
        userPassword
      );

      return signedTx;
    } catch (error) {
      console.error('Transaction signing failed:', error);
      toast({
        variant: "destructive",
        title: "Transaction Failed",
        description: "Unable to sign transaction. Please check your password.",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const getWalletAddress = useCallback(async (): Promise<string | null> => {
    if (!user?.id) {
      return null;
    }

    try {
      const address = await secureWalletService.getWalletAddress(user.id);
      if (address) {
        setWalletAddress(address);
        console.log('✅ Retrieved existing wallet address:', address);
      } else {
        console.log('ℹ️ No wallet found, will create one when needed');
        // Auto-create wallet if none exists
        const walletInfo = await createWallet();
        return walletInfo?.address || null;
      }
      return address;
    } catch (error) {
      console.error('Error getting wallet address:', error);
      return null;
    }
  }, [user, createWallet]);

  const revealPrivateKey = useCallback(async (userPassword?: string): Promise<string | null> => {
    if (!user?.id) {
      return null;
    }

    try {
      setLoading(true);
      
      const privateKey = await secureWalletService.revealPrivateKey(user.id, userPassword);
      
      toast({
        title: "Private Key Revealed",
        description: "Please store this private key safely and never share it.",
      });

      return privateKey;
    } catch (error) {
      console.error('Failed to reveal private key:', error);
      toast({
        variant: "destructive",
        title: "Failed to Reveal Private Key",
        description: "Unable to reveal private key. Please try again.",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  return {
    walletAddress,
    loading,
    createWallet,
    validateAccess,
    signTransaction,
    getWalletAddress,
    revealPrivateKey
  };
};