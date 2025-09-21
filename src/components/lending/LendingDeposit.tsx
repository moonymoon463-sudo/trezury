import { useState } from "react";
import { TokenMarketplace } from "./TokenMarketplace";
import { EnhancedSupplyForm } from "./EnhancedSupplyForm";
import { TestingPanel } from "./TestingPanel";
import { Chain, Token } from "@/types/lending";
import { Button } from "@/components/ui/button";
import { TestTube, Store } from "lucide-react";

export function LendingDeposit() {
  const [currentView, setCurrentView] = useState<'marketplace' | 'form' | 'testing'>('marketplace');
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

  if (currentView === 'testing') {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentView('marketplace')}
            className="flex items-center gap-2"
          >
            <Store className="h-4 w-4" />
            Marketplace
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            Testing Panel
          </Button>
        </div>
        <TestingPanel />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex items-center gap-2"
        >
          <Store className="h-4 w-4" />
          Marketplace
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentView('testing')}
          className="flex items-center gap-2"
        >
          <TestTube className="h-4 w-4" />
          Testing Panel
        </Button>
      </div>
      <TokenMarketplace onSelectToken={handleTokenSelect} />
    </div>
  );
}