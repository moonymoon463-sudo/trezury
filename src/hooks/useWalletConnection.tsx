import { useState, useEffect, useCallback } from 'react';
import { securityService } from '@/services/securityService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

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

const SUPPORTED_NETWORKS = {
  1: 'Ethereum Mainnet',
  11155111: 'Ethereum Sepolia Testnet',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum One'
};

// Function to get MetaMask provider specifically
const getMetaMaskProvider = (): EthereumProvider | null => {
  if (!window.ethereum) return null;
  
  console.log('Checking wallet providers...');
  
  // Function to check if a provider is genuine MetaMask
  const isGenuineMetaMask = (provider: EthereumProvider): boolean => {
    // Reject Trust Wallet even if it claims to be MetaMask
    if (provider.isTrustWallet || provider.isTrust) {
      console.log('Trust Wallet detected - rejecting');
      return false;
    }
    
    // Enhanced MetaMask detection
    const hasMetaMaskFlag = provider.isMetaMask === true;
    const hasMetaMaskObject = provider._metamask && typeof provider._metamask === 'object';
    
    // Additional checks for genuine MetaMask
    const isGenuine = hasMetaMaskFlag && hasMetaMaskObject;
    
    console.log('Provider check:', {
      isMetaMask: hasMetaMaskFlag,
      hasMetaMaskObject: hasMetaMaskObject,
      isTrustWallet: provider.isTrustWallet,
      isGenuine: isGenuine
    });
    
    return isGenuine;
  };
  
  // If ethereum.providers exists, find genuine MetaMask
  if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
    console.log(`Found ${window.ethereum.providers.length} providers`);
    const metaMaskProvider = window.ethereum.providers.find(isGenuineMetaMask);
    if (metaMaskProvider) {
      console.log('Genuine MetaMask found in providers array');
      return metaMaskProvider;
    }
  }
  
  // Check if the main provider is genuine MetaMask
  if (isGenuineMetaMask(window.ethereum)) {
    console.log('Main provider is genuine MetaMask');
    return window.ethereum;
  }
  
  console.log('No genuine MetaMask provider found');
  return null;
};

// Function to check if MetaMask is available
const isMetaMaskAvailable = (): boolean => {
  return getMetaMaskProvider() !== null;
};

export const useWalletConnection = (): UseWalletConnectionReturn => {
  const [wallet, setWallet] = useState<WalletConnectionState>({
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
  const { user } = useAuth();

  useEffect(() => {
    initializeWallet();
    setupEventListeners();

    return () => {
      cleanup();
    };
  }, []);

  const initializeWallet = async () => {
    if (!user) return;
    
    const metaMaskProvider = getMetaMaskProvider();
    if (!metaMaskProvider) {
      console.log('MetaMask not found or not available');
      return;
    }

    try {
      const accounts = await metaMaskProvider.request({ method: 'eth_accounts' });
      setWallet(prev => ({
        ...prev,
        hasAvailableAccounts: accounts.length > 0
      }));
    } catch (error) {
      console.error('Failed to check wallet availability:', error);
    }
  };

  const setupEventListeners = () => {
    const metaMaskProvider = getMetaMaskProvider();
    if (!metaMaskProvider) return;

    metaMaskProvider.on('accountsChanged', handleAccountsChanged);
    metaMaskProvider.on('chainChanged', handleChainChanged);
    metaMaskProvider.on('disconnect', handleDisconnect);
  };

  const cleanup = () => {
    const metaMaskProvider = getMetaMaskProvider();
    if (metaMaskProvider) {
      metaMaskProvider.removeListener('accountsChanged', handleAccountsChanged);
      metaMaskProvider.removeListener('chainChanged', handleChainChanged);
      metaMaskProvider.removeListener('disconnect', handleDisconnect);
    }
  };

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      await updateWalletState(accounts[0]);
      
      // Log account change for security monitoring
      await securityService.logSecurityEvent({
        event_type: 'wallet_account_changed',
        severity: 'medium',
        description: 'User changed wallet account',
        user_id: user?.id,
        metadata: { new_address: accounts[0] }
      });
    }
  };

  const handleChainChanged = async (chainId: string) => {
    const numericChainId = parseInt(chainId, 16);
    const networkName = SUPPORTED_NETWORKS[numericChainId as keyof typeof SUPPORTED_NETWORKS];
    const isSupported = !!networkName;

    setWallet(prev => ({
      ...prev,
      chainId: numericChainId,
      networkName: networkName || 'Unknown Network',
      isSupported
    }));

    // Log chain change
    await securityService.logSecurityEvent({
      event_type: 'wallet_chain_changed',
      severity: 'low',
      description: 'User changed blockchain network',
      user_id: user?.id,
      metadata: { chain_id: numericChainId, supported: isSupported }
    });

    if (!isSupported) {
      toast({
        variant: "destructive",
        title: "Unsupported Network",
        description: "Please switch to Ethereum, Polygon, Base, or Arbitrum"
      });
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const updateWalletState = async (address: string) => {
    const metaMaskProvider = getMetaMaskProvider();
    if (!metaMaskProvider) return;

    try {
      // Get chain ID
      const chainId = await metaMaskProvider.request({ method: 'eth_chainId' });
      const numericChainId = parseInt(chainId, 16);
      const networkName = SUPPORTED_NETWORKS[numericChainId as keyof typeof SUPPORTED_NETWORKS];
      const isSupported = !!networkName;

      // Get balance
      const balance = await metaMaskProvider.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      });
      const ethBalance = (parseInt(balance, 16) / 1e18).toFixed(4);

      setWallet({
        isConnected: true,
        hasAvailableAccounts: true,
        address,
        chainId: numericChainId,
        balance: ethBalance,
        networkName: networkName || 'Unknown Network',
        isSupported
      });
    } catch (error) {
      console.error('Failed to update wallet state:', error);
    }
  };

  const connectWallet = useCallback(async () => {
    if (!isMetaMaskAvailable()) {
      const hasOtherWallet = !!window.ethereum;
      let errorMessage = "Please install MetaMask to connect your wallet";
      
      // Check if Trust Wallet or other wallet is interfering
      if (hasOtherWallet) {
        const isTrustWallet = window.ethereum?.isTrustWallet || window.ethereum?.isTrust;
        if (isTrustWallet) {
          errorMessage = "Trust Wallet detected. Please use MetaMask for this application.";
        } else {
          errorMessage = "Other wallet detected. Please use MetaMask for this application.";
        }
      }
      
      toast({
        variant: "destructive",
        title: "MetaMask Required",
        description: errorMessage
      });
      return;
    }

    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in before connecting your wallet"
      });
      return;
    }

    // Check rate limiting
    const rateLimitCheck = await securityService.checkRateLimit(
      `wallet_connect_${user.id}`,
      { maxRequests: 5, windowMs: 60000 } // 5 attempts per minute
    );

    if (!rateLimitCheck.allowed) {
      toast({
        variant: "destructive",
        title: "Too Many Attempts",
        description: "Please wait before trying to connect again"
      });
      return;
    }

    const metaMaskProvider = getMetaMaskProvider();
    if (!metaMaskProvider) return;

    try {
      setConnecting(true);

      // Request account access from MetaMask specifically
      const accounts = await metaMaskProvider.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }

      await updateWalletState(accounts[0]);

      // Log successful connection
      await securityService.logSecurityEvent({
        event_type: 'wallet_connected',
        severity: 'low',
        description: 'User connected MetaMask wallet successfully',
        user_id: user.id,
        metadata: { address: accounts[0], wallet_type: 'MetaMask' }
      });

      // Get current chain info for toast
      const chainId = await metaMaskProvider.request({ method: 'eth_chainId' });
      const numericChainId = parseInt(chainId, 16);
      const networkName = SUPPORTED_NETWORKS[numericChainId as keyof typeof SUPPORTED_NETWORKS];

      toast({
        title: "MetaMask Connected",
        description: `Connected to ${networkName || 'blockchain network'}`
      });

    } catch (error: any) {
      console.error('MetaMask connection failed:', error);
      
      // Log failed connection attempt
      await securityService.logSecurityEvent({
        event_type: 'wallet_connection_failed',
        severity: 'medium',
        description: 'MetaMask connection attempt failed',
        user_id: user.id,
        metadata: { error: error.message, wallet_type: 'MetaMask' }
      });

      toast({
        variant: "destructive",
        title: "MetaMask Connection Failed",
        description: error.message || "Failed to connect MetaMask"
      });
    } finally {
      setConnecting(false);
    }
  }, [user, toast, wallet.networkName]);

  const disconnectWallet = useCallback(() => {
    setWallet({
      isConnected: false,
      hasAvailableAccounts: false,
      address: null,
      chainId: null,
      balance: null,
      networkName: null,
      isSupported: false
    });

    // Log disconnection
    if (user) {
      securityService.logSecurityEvent({
        event_type: 'wallet_disconnected',
        severity: 'low',
        description: 'User disconnected wallet',
        user_id: user.id
      });
    }

    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected"
    });
  }, [user, toast]);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    const metaMaskProvider = getMetaMaskProvider();
    if (!metaMaskProvider) return;

    try {
      await metaMaskProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }]
      });
    } catch (error: any) {
      if (error.code === 4902) {
        // Network not added, try to add it
        if (targetChainId === 11155111) {
          await addSepoliaNetwork();
        } else {
          toast({
            variant: "destructive",
            title: "Network Not Added",
            description: "Please add this network to MetaMask first"
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Switch Failed",
          description: "Failed to switch network in MetaMask"
        });
      }
    }
  }, [toast]);

  const addSepoliaNetwork = useCallback(async () => {
    const metaMaskProvider = getMetaMaskProvider();
    if (!metaMaskProvider) {
      toast({
        variant: "destructive",
        title: "MetaMask Not Found",
        description: "MetaMask is required to add networks"
      });
      return;
    }

    try {
      await metaMaskProvider.request({
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
        description: "Failed to add Sepolia network to MetaMask"
      });
    }
  }, [toast]);

  const signMessage = useCallback(async (message: string): Promise<string | null> => {
    const metaMaskProvider = getMetaMaskProvider();
    if (!metaMaskProvider || !wallet.address) {
      toast({
        variant: "destructive",
        title: "MetaMask Not Connected",
        description: "Please connect MetaMask first"
      });
      return null;
    }

    try {
      const signature = await metaMaskProvider.request({
        method: 'personal_sign',
        params: [message, wallet.address]
      });

      // Log message signing
      if (user) {
        await securityService.logSecurityEvent({
          event_type: 'message_signed',
          severity: 'medium',
          description: 'User signed a message with MetaMask',
          user_id: user.id,
          metadata: { address: wallet.address, wallet_type: 'MetaMask' }
        });
      }

      return signature;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "MetaMask Signing Failed",
        description: error.message || "Failed to sign message with MetaMask"
      });
      return null;
    }
  }, [wallet.address, user, toast]);

  const validateTransaction = useCallback((params: {
    amount: number;
    asset: string;
    recipient?: string;
    slippage?: number;
  }) => {
    return securityService.validateTransactionSecurity(params);
  }, []);

  return {
    wallet,
    connecting,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    addSepoliaNetwork,
    signMessage,
    validateTransaction
  };
};