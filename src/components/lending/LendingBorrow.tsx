import { useState } from "react";
import { BorrowMarketplace } from "./BorrowMarketplace";
import { EnhancedBorrowForm } from "./EnhancedBorrowForm";
import { Chain, Token } from "@/types/lending";

export function LendingBorrow() {
  const [currentView, setCurrentView] = useState<'marketplace' | 'form'>('marketplace');
  const [selectedToken, setSelectedToken] = useState<{
    chain: Chain;
    token: Token;
    variableRate: number;
    stableRate: number;
  } | null>(null);

  const handleTokenSelect = (chain: Chain, token: Token, variableRate: number, stableRate: number) => {
    setSelectedToken({ chain, token, variableRate, stableRate });
    setCurrentView('form');
  };

  const handleBack = () => {
    setCurrentView('marketplace');
    setSelectedToken(null);
  };

  if (currentView === 'form' && selectedToken) {
    return (
      <EnhancedBorrowForm
        chain={selectedToken.chain}
        token={selectedToken.token}
        variableRate={selectedToken.variableRate}
        stableRate={selectedToken.stableRate}
        onBack={handleBack}
      />
    );
  }

  return <BorrowMarketplace onSelectToken={handleTokenSelect} />;
}