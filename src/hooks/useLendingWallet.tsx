import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { walletService, WalletInfo, WalletBalance } from '@/services/walletService';

/**
 * UNIFIED LENDING WALLET HOOK
 * Clean, simple hook that handles all wallet functionality for lending
 */
export const useLendingWallet = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    if (!user?.id) {
      setWallet(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Loading wallet for user:', user.id);
      const walletInfo = await walletService.getWallet(user.id);
      
      setWallet(walletInfo);
      console.log('✅ Wallet loaded successfully');
    } catch (err) {
      console.error('❌ Failed to load wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load wallet on mount and user change
  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  // Get balance for specific asset
  const getBalance = useCallback((asset: string): number => {
    if (!wallet) return 0;
    const balance = wallet.balances.find(b => b.asset === asset);
    return balance?.amount || 0;
  }, [wallet]);

  // Get all balances
  const getBalances = useCallback((): WalletBalance[] => {
    return wallet?.balances || [];
  }, [wallet]);

  // Get wallet address
  const getAddress = useCallback((): string | null => {
    return wallet?.address || null;
  }, [wallet]);

  // Refresh wallet data
  const refreshWallet = useCallback(async () => {
    await loadWallet();
  }, [loadWallet]);

  return {
    // Wallet data
    wallet,
    loading,
    error,
    
    // Utility functions
    getBalance,
    getBalances,
    getAddress,
    refreshWallet,
    
    // Legacy compatibility
    walletAddress: wallet?.address || null,
    balances: wallet?.balances || [],
    fetchBalances: refreshWallet
  };
};