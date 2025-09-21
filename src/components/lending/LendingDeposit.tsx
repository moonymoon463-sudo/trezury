import { useState } from "react";
import { TokenMarketplace } from "./TokenMarketplace";
import { EnhancedSupplyForm } from "./EnhancedSupplyForm";
import { QuickActions } from "./QuickActions";
import { Chain, Token } from "@/types/lending";
import { Button } from "@/components/ui/button";
import { Zap, Store } from "lucide-react";

export function LendingDeposit() {
  const [currentView, setCurrentView] = useState<'quickactions' | 'marketplace' | 'form'>('quickactions');
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
    setCurrentView('quickactions');
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

  if (currentView === 'marketplace') {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentView('quickactions')}
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Quick Actions
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <Store className="h-4 w-4" />
            Market Explorer
          </Button>
        </div>
        <TokenMarketplace onSelectToken={handleTokenSelect} />
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
          <Zap className="h-4 w-4" />
          Quick Actions
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentView('marketplace')}
          className="flex items-center gap-2"
        >
          <Store className="h-4 w-4" />
          Market Explorer
        </Button>
      </div>
      <QuickActions />
    </div>
  );
}