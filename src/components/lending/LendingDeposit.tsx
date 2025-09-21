import { useState } from "react";
import { TokenMarketplace } from "./TokenMarketplace";
import { EnhancedSupplyForm } from "./EnhancedSupplyForm";
import { Chain, Token } from "@/types/lending";

export function LendingDeposit() {
  const [currentView, setCurrentView] = useState<'marketplace' | 'form'>('marketplace');
  const [selectedToken, setSelectedToken] = useState<{
    chain: Chain;
    token: Token;
    apy: number;
  } | null>(null);

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

  return <TokenMarketplace onSelectToken={handleTokenSelect} />;
}