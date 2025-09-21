import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";
import { TokenMarketplace } from "./TokenMarketplace";
import { TestnetFaucet } from "./TestnetFaucet";
import { EnhancedSupplyForm } from "./EnhancedSupplyForm";
import { Chain, Token } from "@/types/lending";
import { useLendingWallet } from "@/hooks/useLendingWallet";
import { useToast } from "@/hooks/use-toast";

export function LendingDeposit() {
  const { wallet, loading: walletLoading, getAddress, getBalances } = useLendingWallet();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<'marketplace' | 'form'>('marketplace');
  const [selectedToken, setSelectedToken] = useState<{
    chain: Chain;
    token: Token;
    apy: number;
  } | null>(null);

  const walletAddress = getAddress();
  const balances = getBalances();

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
                  
                   {/* Wallet Balances */}
                   <div className="space-y-2">
                     <div className="text-sm text-muted-foreground">Wallet Balances:</div>
                     <div className="grid grid-cols-3 gap-2">
                       {walletLoading ? (
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
               ) : walletLoading ? (
                 <div className="text-center py-4">
                   <div className="text-muted-foreground mb-2">
                     Setting up your wallet...
                   </div>
                   <Badge variant="outline">
                     🔄 Loading wallet
                   </Badge>
                 </div>
               ) : (
                 <div className="text-center py-4">
                   <div className="text-muted-foreground mb-2">
                     Wallet setup failed. Please try refreshing the page.
                   </div>
                   <Badge variant="destructive">
                     ❌ Wallet unavailable
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