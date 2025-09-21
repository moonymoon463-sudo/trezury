import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { securityService } from '@/services/securityService';
import { useToast } from '@/hooks/use-toast';

// Define ethereum provider interface
interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
  isTrustWallet?: boolean;
  isTrust?: boolean;
  _metamask?: any;
  providers?: EthereumProvider[];
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export interface WalletConnectionState {
  isConnected: boolean;
  hasAvailableAccounts: boolean;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  networkName: string | null;
  isSupported: boolean;
}

interface WalletConnectionContextType {
  // Flattened wallet state for backward compatibility
  isConnected: boolean;
  hasAvailableAccounts: boolean;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  networkName: string | null;
  isSupported: boolean;
  
  // For backward compatibility - provide wallet object
  wallet: WalletConnectionState;
  
  // Actions
  connecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  addSepoliaNetwork: () => Promise<void>;
  signMessage: (message: string) => Promise<string | null>;
  validateTransaction: (params: any) => { isValid: boolean; errors: string[]; warnings: string[] };
}

const WalletConnectionContext = createContext<WalletConnectionContextType | undefined>(undefined);

const SUPPORTED_NETWORKS = {
  1: 'Ethereum Mainnet',
  11155111: 'Ethereum Sepolia Testnet',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum One'
};

// More resilient provider detection - fallback to any ethereum provider
const getEthereumProvider = (): EthereumProvider | null => {
  if (!window.ethereum) return null;
  
  console.log('🔍 Checking wallet providers...');
  
  // Try to find MetaMask first
  const findMetaMask = (provider: EthereumProvider): boolean => {
    if (provider.isTrustWallet || provider.isTrust) return false;
    return provider.isMetaMask === true && provider._metamask;
  };

  // Check if ethereum.providers exists
  if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
    const metaMaskProvider = window.ethereum.providers.find(findMetaMask);
    if (metaMaskProvider) {
      console.log('✅ MetaMask found in providers array');
      return metaMaskProvider;
    }
  }
  
  // Check main provider
  if (findMetaMask(window.ethereum)) {
    console.log('✅ Main provider is MetaMask');
    return window.ethereum;
  }
  
  // Fallback to any ethereum provider for development
  console.log('⚠️ MetaMask not found, using fallback ethereum provider');
  return window.ethereum;
};

export function WalletConnectionProvider({ children }: { children: ReactNode }) {
  const [walletState, setWalletState] = useState<WalletConnectionState>({
    isConnected: false,
    hasAvailableAccounts: false,
    address: null,
    chainId: null,
    balance: null,
    networkName: null,
    isSupported: false
  });
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('🔌 Initializing wallet connection provider...');
    initializeWallet();
    setupEventListeners();

    return cleanup;
  }, []);

  const initializeWallet = async () => {
    const provider = getEthereumProvider();
    if (!provider) {
      console.log('❌ No ethereum provider found');
      return;
    }

    try {
      const accounts = await provider.request({ method: 'eth_accounts' });
      console.log('📊 Found accounts:', accounts.length);
      
      if (accounts.length > 0) {
        await updateWalletState(accounts[0]);
        console.log('✅ Wallet auto-connected to:', accounts[0]);
      } else {
        setWalletState(prev => ({ ...prev, hasAvailableAccounts: false }));
      }
    } catch (error) {
      console.error('❌ Failed to initialize wallet:', error);
    }
  };

  const setupEventListeners = () => {
    const provider = getEthereumProvider();
    if (!provider) return;

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);
    provider.on('disconnect', handleDisconnect);
  };

  const cleanup = () => {
    const provider = getEthereumProvider();
    if (provider) {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
      provider.removeListener('disconnect', handleDisconnect);
    }
  };

  const handleAccountsChanged = async (accounts: string[]) => {
    console.log('🔄 Accounts changed:', accounts.length);
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      await updateWalletState(accounts[0]);
    }
  };

  const handleChainChanged = async (chainId: string) => {
    const numericChainId = parseInt(chainId, 16);
    const networkName = SUPPORTED_NETWORKS[numericChainId as keyof typeof SUPPORTED_NETWORKS];
    const isSupported = !!networkName;

    console.log('🔗 Chain changed:', numericChainId, networkName);

    setWalletState(prev => ({
      ...prev,
      chainId: numericChainId,
      networkName: networkName || 'Unknown Network',
      isSupported
    }));

    if (!isSupported) {
      toast({
        variant: "destructive",
        title: "Unsupported Network",
        description: "Please switch to Ethereum, Polygon, Base, or Arbitrum"
      });
    }
  };

  const handleDisconnect = () => {
    console.log('🔌 Wallet disconnected');
    disconnectWallet();
  };

  const updateWalletState = async (address: string) => {
    const provider = getEthereumProvider();
    if (!provider) return;

    try {
      // Get chain ID
      const chainId = await provider.request({ method: 'eth_chainId' });
      const numericChainId = parseInt(chainId, 16);
      const networkName = SUPPORTED_NETWORKS[numericChainId as keyof typeof SUPPORTED_NETWORKS];
      const isSupported = !!networkName;

      // Get balance
      const balance = await provider.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      });
      const ethBalance = (parseInt(balance, 16) / 1e18).toFixed(4);

      const newState = {
        isConnected: true,
        hasAvailableAccounts: true,
        address,
        chainId: numericChainId,
        balance: ethBalance,
        networkName: networkName || 'Unknown Network',
        isSupported
      };

      console.log('📊 Wallet state updated:', newState);
      setWalletState(newState);
    } catch (error) {
      console.error('❌ Failed to update wallet state:', error);
    }
  };

  const connectWallet = useCallback(async () => {
    console.log('🚀 Starting wallet connection...');
    
    const provider = getEthereumProvider();
    if (!provider) {
      toast({
        variant: "destructive",
        title: "Wallet Not Found",
        description: "Please install MetaMask or another Ethereum wallet"
      });
      return;
    }

    try {
      setConnecting(true);
      console.log('📡 Requesting account access...');

      const accounts = await provider.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts returned from wallet');
      }

      await updateWalletState(accounts[0]);

      // Auto-switch to Sepolia if needed
      const chainId = await provider.request({ method: 'eth_chainId' });
      const numericChainId = parseInt(chainId, 16);
      
      if (numericChainId !== 11155111) {
        console.log('🔗 Auto-switching to Sepolia testnet...');
        await switchNetwork(11155111);
      }

      toast({
        title: "Wallet Connected",
        description: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`
      });

    } catch (error: any) {
      console.error('❌ Wallet connection failed:', error);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet"
      });
    } finally {
      setConnecting(false);
    }
  }, [toast]);

  const disconnectWallet = useCallback(() => {
    console.log('🔌 Disconnecting wallet...');
    setWalletState({
      isConnected: false,
      hasAvailableAccounts: false,
      address: null,
      chainId: null,
      balance: null,
      networkName: null,
      isSupported: false
    });

    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected"
    });
  }, [toast]);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    const provider = getEthereumProvider();
    if (!provider) return;

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }]
      });
    } catch (error: any) {
      if (error.code === 4902 && targetChainId === 11155111) {
        await addSepoliaNetwork();
      } else {
        toast({
          variant: "destructive",
          title: "Switch Failed",
          description: "Failed to switch network"
        });
      }
    }
  }, [toast]);

  const addSepoliaNetwork = useCallback(async () => {
    const provider = getEthereumProvider();
    if (!provider) return;

    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0xaa36a7',
          chainName: 'Ethereum Sepolia Testnet',
          nativeCurrency: {
            name: 'Sepolia Ether',
            symbol: 'SEP',
            decimals: 18,
          },
          rpcUrls: ['https://rpc.ankr.com/eth_sepolia'],
          blockExplorerUrls: ['https://sepolia.etherscan.io/'],
        }],
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Network Add Failed",
        description: "Failed to add Sepolia network"
      });
    }
  }, [toast]);

  const signMessage = useCallback(async (message: string): Promise<string | null> => {
    const provider = getEthereumProvider();
    if (!provider || !walletState.address) {
      toast({
        variant: "destructive",
        title: "Wallet Not Connected",
        description: "Please connect your wallet first"
      });
      return null;
    }

    try {
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, walletState.address]
      });
      return signature;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signing Failed",
        description: error.message || "Failed to sign message"
      });
      return null;
    }
  }, [walletState.address, toast]);

  const validateTransaction = useCallback((params: any) => {
    // Basic validation logic
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params.amount || params.amount <= 0) {
      errors.push('Invalid amount');
    }

    if (!walletState.isConnected) {
      errors.push('Wallet not connected');
    }

    if (!walletState.isSupported) {
      warnings.push('Unsupported network');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [walletState]);

  const contextValue: WalletConnectionContextType = {
    // Flatten wallet state properties
    ...walletState,
    
    // Provide wallet object for backward compatibility
    wallet: walletState,
    
    // Actions
    connecting,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    addSepoliaNetwork,
    signMessage,
    validateTransaction
  };

  return (
    <WalletConnectionContext.Provider value={contextValue}>
      {children}
    </WalletConnectionContext.Provider>
  );
}

export function useWalletConnection() {
  const context = useContext(WalletConnectionContext);
  if (!context) {
    throw new Error('useWalletConnection must be used within a WalletConnectionProvider');
  }
  return context;
}