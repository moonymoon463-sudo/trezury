// This file is now deprecated - use WalletConnectionContext instead
// Re-export for backward compatibility  
export { useWalletConnection } from '@/contexts/WalletConnectionContext';
export type { WalletConnectionState } from '@/contexts/WalletConnectionContext';

// Import type for interface definition
import type { WalletConnectionState } from '@/contexts/WalletConnectionContext';

// For backward compatibility with existing components
export interface UseWalletConnectionReturn {
  wallet: WalletConnectionState;
  connecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  addSepoliaNetwork: () => Promise<void>;
  signMessage: (message: string) => Promise<string | null>;
  validateTransaction: (params: any) => { isValid: boolean; errors: string[]; warnings: string[] };
}