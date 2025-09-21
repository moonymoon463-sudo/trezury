import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";
import { TokenMarketplace } from "./TokenMarketplace";
import { TestnetFaucet } from "./TestnetFaucet";
import { EnhancedSupplyForm } from "./EnhancedSupplyForm";
import { Chain, Token } from "@/types/lending";
import { useAaveStyleLending } from "@/hooks/useAaveStyleLending";
import { useSecureWallet } from "@/hooks/useSecureWallet";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export function LendingDeposit() {
  const { user } = useAuth();
  const { walletAddress, createWallet } = useAaveStyleLending();
  const { getWalletAddress } = useSecureWallet();
  const { balances, loading: balancesLoading } = useWalletBalance();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<'marketplace' | 'form'>('marketplace');
  const [selectedToken, setSelectedToken] = useState<{
    chain: Chain;
    token: Token;
    apy: number;
  } | null>(null);

  // Auto-setup internal wallet when user first loads
  useEffect(() => {
    const setupWallet = async () => {
      if (!walletAddress && user?.id) {
        try {
          // Get existing wallet address or create new one automatically
          await getWalletAddress();
          console.log('✅ Wallet setup completed');
        } catch (error) {
          console.error('Wallet setup failed:', error);
        }
      }
    };
    
    setupWallet();
  }, [user?.id, walletAddress, getWalletAddress]);

  const handleTokenSelect = (chain: Chain, token: Token, apy: number) => {
    setSelectedToken({ chain, token, apy });
    setCurrentView('form');
  };

  const handleBack = () => {
    setCurrentView('marketplace');
    setSelectedToken(null);
  };

  if (currentView === 'form' && selectedToken) {
    return (
      <EnhancedSupplyForm
        chain={selectedToken.chain}
        token={selectedToken.token}
        initialAPY={selectedToken.apy}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Internal Wallet Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Internal Wallet - Sepolia Testnet
            </CardTitle>
            <CardDescription>
              Your secure internal wallet with real testnet balances
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {walletAddress ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">Wallet Address:</div>
                  <div className="font-mono text-sm bg-muted p-2 rounded break-all">
                    {walletAddress}
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    ✅ Internal Wallet Active
                  </Badge>
                  
                  {/* Real Testnet Balances */}
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Testnet Balances:</div>
                    <div className="grid grid-cols-3 gap-2">
                      {balancesLoading ? (
                        <div className="col-span-3 text-center text-muted-foreground">
                          Loading balances...
                        </div>
                      ) : (
                        balances.map((balance) => (
                          <div key={balance.asset} className="bg-muted/50 p-2 rounded text-center">
                            <div className="font-semibold">{balance.amount.toFixed(4)}</div>
                            <div className="text-xs text-muted-foreground">{balance.asset}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-muted-foreground mb-2">
                    Internal wallet will be created automatically when needed
                  </div>
                  <Badge variant="outline">
                    🔄 Wallet will auto-setup on first transaction
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Testnet Faucet */}
        <TestnetFaucet />
      </div>

      {/* Lending Marketplace */}
      <TokenMarketplace onSelectToken={handleTokenSelect} />
    </div>
  );
}