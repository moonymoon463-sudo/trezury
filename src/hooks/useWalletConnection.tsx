import { useState, useEffect, useCallback } from 'react';
import { securityService } from '@/services/securityService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface WalletConnectionState {
  isConnected: boolean;
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
  signMessage: (message: string) => Promise<string | null>;
  validateTransaction: (params: any) => { isValid: boolean; errors: string[]; warnings: string[] };
}

const SUPPORTED_NETWORKS = {
  1: 'Ethereum Mainnet',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum One'
};

export const useWalletConnection = (): UseWalletConnectionReturn => {
  const [wallet, setWallet] = useState<WalletConnectionState>({
    isConnected: false,
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
    if (!window.ethereum || !user) return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        await updateWalletState(accounts[0]);
      }
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
    }
  };

  const setupEventListeners = () => {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);
  };

  const cleanup = () => {
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      window.ethereum.removeListener('disconnect', handleDisconnect);
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
    try {
      // Get chain ID
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const numericChainId = parseInt(chainId, 16);
      const networkName = SUPPORTED_NETWORKS[numericChainId as keyof typeof SUPPORTED_NETWORKS];
      const isSupported = !!networkName;

      // Get balance
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      });
      const ethBalance = (parseInt(balance, 16) / 1e18).toFixed(4);

      setWallet({
        isConnected: true,
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
    if (!window.ethereum) {
      toast({
        variant: "destructive",
        title: "Wallet Not Found",
        description: "Please install MetaMask or another Web3 wallet"
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

    try {
      setConnecting(true);

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts returned from wallet');
      }

      await updateWalletState(accounts[0]);

      // Log successful connection
      await securityService.logSecurityEvent({
        event_type: 'wallet_connected',
        severity: 'low',
        description: 'User connected wallet successfully',
        user_id: user.id,
        metadata: { address: accounts[0] }
      });

      toast({
        title: "Wallet Connected",
        description: `Connected to ${wallet.networkName || 'blockchain network'}`
      });

    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      
      // Log failed connection attempt
      await securityService.logSecurityEvent({
        event_type: 'wallet_connection_failed',
        severity: 'medium',
        description: 'Wallet connection attempt failed',
        user_id: user.id,
        metadata: { error: error.message }
      });

      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet"
      });
    } finally {
      setConnecting(false);
    }
  }, [user, toast, wallet.networkName]);

  const disconnectWallet = useCallback(() => {
    setWallet({
      isConnected: false,
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
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }]
      });
    } catch (error: any) {
      if (error.code === 4902) {
        toast({
          variant: "destructive",
          title: "Network Not Added",
          description: "Please add this network to your wallet first"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Switch Failed",
          description: "Failed to switch network"
        });
      }
    }
  }, [toast]);

  const signMessage = useCallback(async (message: string): Promise<string | null> => {
    if (!window.ethereum || !wallet.address) {
      toast({
        variant: "destructive",
        title: "Wallet Not Connected",
        description: "Please connect your wallet first"
      });
      return null;
    }

    try {
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, wallet.address]
      });

      // Log message signing
      if (user) {
        await securityService.logSecurityEvent({
          event_type: 'message_signed',
          severity: 'medium',
          description: 'User signed a message with wallet',
          user_id: user.id,
          metadata: { address: wallet.address }
        });
      }

      return signature;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signing Failed",
        description: error.message || "Failed to sign message"
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
    signMessage,
    validateTransaction
  };
};