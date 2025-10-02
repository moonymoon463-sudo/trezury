import { useState, useCallback } from 'react';
import { secureWalletService, SecureWalletInfo } from '@/services/secureWalletService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface UseSecureWalletReturn {
  walletAddress: string | null;
  loading: boolean;
  createWallet: (userPassword: string) => Promise<SecureWalletInfo | null>;
  validateAccess: () => Promise<boolean>;
  signTransaction: (transactionData: Record<string, unknown>, userPassword: string) => Promise<string | null>;
  getWalletAddress: () => Promise<string | null>;
  revealPrivateKey: (userPassword: string) => Promise<string | null>;
}

/**
 * Hook for secure wallet operations
 * All operations require password authentication
 */
export const useSecureWallet = (): UseSecureWalletReturn => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const createWallet = useCallback(async (userPassword: string): Promise<SecureWalletInfo | null> => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to create a wallet"
      });
      return null;
    }

    if (!userPassword || userPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "Invalid Password",
        description: "Password must be at least 8 characters"
      });
      return null;
    }

    setLoading(true);
    try {
      // Check if wallet already exists
      const existingAddress = await secureWalletService.getWalletAddress(user.id);
      if (existingAddress) {
        setWalletAddress(existingAddress);
        toast({
          title: "Wallet Already Exists",
          description: `Address: ${existingAddress.substring(0, 6)}...${existingAddress.substring(38)}`
        });
        return { address: existingAddress, publicKey: existingAddress };
      }

      // Generate new secure wallet
      const walletInfo = await secureWalletService.generateDeterministicWallet(
        user.id,
        { userPassword }
      );
      setWalletAddress(walletInfo.address);
      
      toast({
        title: "Secure Wallet Created",
        description: "Your password-protected wallet has been generated"
      });

      return walletInfo;
    } catch (error) {
      console.error('Wallet creation failed:', error);
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

  const validateAccess = useCallback(async (): Promise<boolean> => {
    if (!user) {
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
    userPassword: string
  ): Promise<string | null> => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in to sign transactions"
      });
      return null;
    }

    if (!userPassword) {
      toast({
        variant: "destructive",
        title: "Password Required",
        description: "Password is required to sign transactions"
      });
      return null;
    }

    setLoading(true);
    try {
      const signature = await secureWalletService.signTransaction(
        user.id,
        transactionData,
        userPassword
      );
      
      toast({
        title: "Transaction Signed",
        description: "Your transaction has been signed successfully"
      });

      return signature;
    } catch (error) {
      console.error('Transaction signing failed:', error);
      toast({
        variant: "destructive",
        title: "Transaction Failed",
        description: "Unable to sign transaction. Please check your password."
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const getWalletAddress = useCallback(async (): Promise<string | null> => {
    if (!user) {
      return null;
    }

    try {
      const address = await secureWalletService.getWalletAddress(user.id);
      if (address) {
        setWalletAddress(address);
      }
      return address;
    } catch (error) {
      console.error('Error getting wallet address:', error);
      return null;
    }
  }, [user]);

  const revealPrivateKey = useCallback(async (userPassword: string): Promise<string | null> => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please sign in first"
      });
      return null;
    }

    if (!userPassword) {
      toast({
        variant: "destructive",
        title: "Password Required",
        description: "Password is required to reveal private key"
      });
      return null;
    }

    setLoading(true);
    try {
      const privateKey = await secureWalletService.revealPrivateKey(user.id, userPassword);
      
      toast({
        title: "Private Key Retrieved",
        description: "⚠️ CRITICAL: Never share this key with anyone",
        variant: "destructive"
      });

      return privateKey;
    } catch (error) {
      console.error('Failed to reveal private key:', error);
      toast({
        variant: "destructive",
        title: "Failed to Reveal Key",
        description: error instanceof Error ? error.message : "Incorrect password or error"
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
