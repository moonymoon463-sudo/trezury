import { useState } from 'react';
import { useWalletConnection } from "./useWalletConnection";

export interface WalletBalance {
  asset: string;
  amount: number;
  chain: string;
}

// Stub implementation for wallet balance (lending functionality removed)
export function useWalletBalance() {
  const { } = useWalletConnection();
  const [loading] = useState(false);
  
  return {
    balances: [] as WalletBalance[],
    totalValue: 0,
    loading,
    isConnected: false,
    refreshBalances: () => Promise.resolve(),
    fetchBalances: () => Promise.resolve(),
    getBalance: (asset: string) => 0,
  };
}