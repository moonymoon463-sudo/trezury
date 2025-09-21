import { useState, useEffect } from "react";
import { TokenMarketplace } from "./TokenMarketplace";
import { EnhancedSupplyForm } from "./EnhancedSupplyForm";
import { Chain, Token } from "@/types/lending";
import { useAaveStyleLending } from "@/hooks/useAaveStyleLending";
import { useToast } from "@/hooks/use-toast";

export function LendingDeposit() {
  const { walletAddress, createWallet } = useAaveStyleLending();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<'marketplace' | 'form'>('marketplace');
  const [selectedToken, setSelectedToken] = useState<{
    chain: Chain;
    token: Token;
    apy: number;
  } | null>(null);

  // Auto-create wallet on component mount
  useEffect(() => {
    const setupWallet = async () => {
      if (!walletAddress) {
        try {
          await createWallet();
        } catch (error) {
          console.error('Failed to auto-create wallet:', error);
        }
      }
    };
    
    setupWallet();
  }, [walletAddress, createWallet]);

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
    <div className="space-y-4">
      {walletAddress && (
        <div className="text-sm text-muted-foreground text-center">
          Internal Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </div>
      )}
      <TokenMarketplace onSelectToken={handleTokenSelect} />
    </div>
  );
}