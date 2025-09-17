import { useState, useCallback } from 'react';
import { secureWalletService, SecureWalletInfo } from '@/services/secureWalletService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface UseSecureWalletReturn {
  walletAddress: string | null;
  loading: boolean;
  createWallet: (password: string) => Promise<SecureWalletInfo | null>;
  validateAccess: (password: string) => Promise<boolean>;
  signTransaction: (transactionData: Record<string, unknown>, password: string) => Promise<string | null>;
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

  const createWallet = useCallback(async (password: string): Promise<SecureWalletInfo | null> => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to create a wallet"
      });
      return null;
    }

    if (password.length < 12) {
      toast({
        variant: "destructive",
        title: "Password Too Weak",
        description: "Password must be at least 12 characters long"
      });
      return null;
    }

    try {
      setLoading(true);
      
      const walletInfo = await secureWalletService.generateDeterministicWallet(
        user.id,
        { userPassword: password }
      );

      setWalletAddress(walletInfo.address);
      
      toast({
        title: "Secure Wallet Created",
        description: "Your wallet has been created without storing any private keys"
      });

      return walletInfo;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Wallet Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create wallet"
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const validateAccess = useCallback(async (password: string): Promise<boolean> => {
    if (!user?.id) {
      return false;
    }

    try {
      setLoading(true);
      return await secureWalletService.validateWalletAccess(user.id, password);
    } catch (error) {
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const signTransaction = useCallback(async (
    transactionData: Record<string, unknown>, 
    password: string
  ): Promise<string | null> => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to sign transactions"
      });
      return null;
    }

    try {
      setLoading(true);
      
      // First validate password
      const isValid = await secureWalletService.validateWalletAccess(user.id, password);
      if (!isValid) {
        toast({
          variant: "destructive",
          title: "Invalid Password",
          description: "The password provided is incorrect"
        });
        return null;
      }

      // Sign transaction
      const signedTx = await secureWalletService.signTransaction(
        user.id,
        transactionData,
        password
      );

      return signedTx;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Transaction Signing Failed",
        description: error instanceof Error ? error.message : "Failed to sign transaction"
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