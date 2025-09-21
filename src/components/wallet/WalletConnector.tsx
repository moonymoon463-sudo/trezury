import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ExternalLink, Shield, Copy, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWalletConnection } from "@/hooks/useWalletConnection";

const SUPPORTED_CHAINS = {
  1: 'Ethereum Mainnet',
  11155111: 'Ethereum Sepolia Testnet',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum One'
};

export const WalletConnector: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { wallet, connecting, connectWallet, disconnectWallet, switchNetwork } = useWalletConnection();

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard"
      });
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Check if MetaMask is available
  const isMetaMaskAvailable = (() => {
    if (!window.ethereum) return false;
    if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
      return window.ethereum.providers.some((provider: any) => provider.isMetaMask);
    }
    return window.ethereum.isMetaMask;
  })();

  if (!isMetaMaskAvailable) {
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
          {wallet.isConnected 
            ? "Your wallet is connected and ready"
            : wallet.hasAvailableAccounts
              ? "MetaMask is available - connect to start trading"
              : "Connect your wallet to start trading"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!wallet.isConnected ? (
          <div className="space-y-4">
            <Button
              onClick={connectWallet}
              disabled={connecting || !user}
              className="w-full"
            >
              {connecting ? "Connecting..." : "Connect MetaMask"}
            </Button>
            
            {wallet.hasAvailableAccounts && (
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Shield className="h-4 w-4 text-blue-500 mt-0.5" />
                <div className="text-xs text-blue-400">
                  <div className="font-medium">MetaMask Available</div>
                  <div>Click connect to start using the application</div>
                </div>
              </div>
            )}
          </div>
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
                  {formatAddress(wallet.address!)}
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
                {wallet.isSupported ? (
                  <Badge variant="outline">
                    {wallet.networkName}
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
            {wallet.balance && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Balance</span>
                <span className="font-mono text-sm">
                  {wallet.balance} ETH
                </span>
              </div>
            )}

            {/* Quick Network Switch */}
            {!wallet.isSupported && (
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Switch to supported network:</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => switchNetwork(11155111)}
                  >
                    Sepolia
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => switchNetwork(8453)}
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
              onClick={disconnectWallet}
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