import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ExternalLink, Shield, Copy, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  provider: any;
}

const SUPPORTED_CHAINS = {
  1: 'Ethereum Mainnet',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum'
};

export const WalletConnector: React.FC = () => {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    chainId: null,
    balance: null,
    provider: null
  });
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    checkWalletConnection();
    setupEventListeners();
    
    return () => {
      if (window.ethereum) {
        // Remove specific event listeners instead of all listeners
        window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener?.('chainChanged', handleChainChanged);
        window.ethereum.removeListener?.('disconnect', handleDisconnect);
      }
    };
  }, []);

  const checkWalletConnection = async () => {
    if (!window.ethereum) return;

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_accounts'
      });

      if (accounts.length > 0) {
        await connectWallet();
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  const setupEventListeners = () => {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnect();
    } else {
      setWalletState(prev => ({ ...prev, address: accounts[0] }));
      getBalance(accounts[0]);
    }
  };

  const handleChainChanged = (chainId: string) => {
    const numericChainId = parseInt(chainId, 16);
    setWalletState(prev => ({ ...prev, chainId: numericChainId }));
    
    if (!SUPPORTED_CHAINS[numericChainId as keyof typeof SUPPORTED_CHAINS]) {
      toast({
        variant: "destructive",
        title: "Unsupported Network",
        description: "Please switch to Ethereum, Polygon, Base, or Arbitrum"
      });
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast({
        variant: "destructive",
        title: "MetaMask Not Found",
        description: "Please install MetaMask to connect your wallet"
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

    try {
      setConnecting(true);

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      // Get chain ID
      const chainId = await window.ethereum.request({
        method: 'eth_chainId'
      });

      const numericChainId = parseInt(chainId, 16);
      const address = accounts[0];

      setWalletState({
        isConnected: true,
        address,
        chainId: numericChainId,
        balance: null,
        provider: window.ethereum
      });

      // Get balance
      await getBalance(address);

      // Validate supported chain
      if (!SUPPORTED_CHAINS[numericChainId as keyof typeof SUPPORTED_CHAINS]) {
        toast({
          variant: "destructive",
          title: "Unsupported Network",
          description: "Please switch to a supported network"
        });
      } else {
        toast({
          title: "Wallet Connected",
          description: `Connected to ${SUPPORTED_CHAINS[numericChainId as keyof typeof SUPPORTED_CHAINS]}`
        });
      }

    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet"
      });
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setWalletState({
      isConnected: false,
      address: null,
      chainId: null,
      balance: null,
      provider: null
    });

    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected"
    });
  };

  const getBalance = async (address: string) => {
    if (!window.ethereum) return;

    try {
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      });

      // Convert from wei to ETH
      const ethBalance = (parseInt(balance, 16) / 1e18).toFixed(4);
      setWalletState(prev => ({ ...prev, balance: ethBalance }));
    } catch (error) {
      console.error('Failed to get balance:', error);
    }
  };

  const switchToSupportedChain = async (chainId: number) => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }]
      });
    } catch (error: any) {
      if (error.code === 4902) {
        // Chain not added to MetaMask
        toast({
          variant: "destructive",
          title: "Network Not Added",
          description: "Please add this network to MetaMask first"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Switch Failed",
          description: "Failed to switch network"
        });
      }
    }
  };

  const copyAddress = () => {
    if (walletState.address) {
      navigator.clipboard.writeText(walletState.address);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard"
      });
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!window.ethereum) {
    return (
      <Card className="w-full max-w-md mx-auto bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Wallet className="h-5 w-5" />
            Wallet Required
          </CardTitle>
          <CardDescription>
            Install MetaMask to connect your wallet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => window.open('https://metamask.io/', '_blank')}
            className="w-full"
            variant="outline"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Install MetaMask
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Wallet className="h-5 w-5" />
          Wallet Connection
        </CardTitle>
        <CardDescription>
          {walletState.isConnected 
            ? "Your wallet is connected and ready"
            : "Connect your wallet to start trading"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!walletState.isConnected ? (
          <Button
            onClick={connectWallet}
            disabled={connecting || !user}
            className="w-full"
          >
            {connecting ? "Connecting..." : "Connect MetaMask"}
          </Button>
        ) : (
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                Connected
              </Badge>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Address</span>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <span className="font-mono text-sm flex-1">
                  {formatAddress(walletState.address!)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyAddress}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Network */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Network</span>
              <div className="flex items-center gap-2">
                {walletState.chainId && SUPPORTED_CHAINS[walletState.chainId as keyof typeof SUPPORTED_CHAINS] ? (
                  <Badge variant="outline">
                    {SUPPORTED_CHAINS[walletState.chainId as keyof typeof SUPPORTED_CHAINS]}
                  </Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <Badge variant="destructive">
                      Unsupported
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Balance */}
            {walletState.balance && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Balance</span>
                <span className="font-mono text-sm">
                  {walletState.balance} ETH
                </span>
              </div>
            )}

            {/* Quick Network Switch */}
            {walletState.chainId && !SUPPORTED_CHAINS[walletState.chainId as keyof typeof SUPPORTED_CHAINS] && (
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Switch to supported network:</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => switchToSupportedChain(1)}
                  >
                    Ethereum
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => switchToSupportedChain(8453)}
                  >
                    Base
                  </Button>
                </div>
              </div>
            )}

            {/* Security Notice */}
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <Shield className="h-4 w-4 text-blue-500 mt-0.5" />
              <div className="text-xs text-blue-400">
                <div className="font-medium">Secure Connection</div>
                <div>Your private keys remain in your wallet</div>
              </div>
            </div>

            <Button
              onClick={disconnect}
              variant="outline"
              className="w-full"
            >
              Disconnect Wallet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};