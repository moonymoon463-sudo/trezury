import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ExternalLink } from 'lucide-react';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  dydxAddress: string;
  availableBalance: number;
  internalAddress?: string;
  onWithdrawComplete: () => void;
}

export const WithdrawModal = ({
  isOpen,
  onClose,
  dydxAddress,
  availableBalance,
  internalAddress,
  onWithdrawComplete
}: WithdrawModalProps) => {
  const [widgetReady, setWidgetReady] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadWidget();
    }
  }, [isOpen]);

  const loadWidget = async () => {
    // Skip Widget will be properly integrated with correct API setup
    // For now, show instructions
    setWidgetReady(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-[#2a251a] border-[#463c25] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">Withdraw from Trading Wallet</DialogTitle>
          <DialogDescription className="text-[#c6b795]">
            Powered by Skip Go - Bridge USDC to any chain
          </DialogDescription>
        </DialogHeader>

        {/* Balance Display */}
        <div className="bg-[#211d12] p-4 rounded-lg border border-[#463c25] mb-4">
          <div className="text-[#c6b795] text-xs mb-1">Available Balance</div>
          <div className="text-white text-2xl font-bold">{availableBalance.toFixed(2)} USDC</div>
        </div>

        {/* Withdrawal Instructions */}
        <div className="bg-[#211d12] p-6 rounded-lg border border-[#463c25]">
          <h3 className="text-white font-semibold mb-3">Cross-Chain Withdrawal via Skip Go</h3>
          <p className="text-[#c6b795] text-sm mb-4">
            Use Skip Go to withdraw USDC from dYdX to any supported chain.
          </p>
          <ol className="space-y-2 text-[#c6b795] text-sm mb-4">
            <li>1. Visit <a href="https://skip.money" target="_blank" className="text-[#e6b951] underline">skip.money</a></li>
            <li>2. Select dYdX Chain as source</li>
            <li>3. Enter your dYdX address: <code className="text-xs bg-[#463c25] px-1 py-0.5 rounded">{dydxAddress}</code></li>
            <li>4. Choose destination chain and address</li>
            <li>5. Complete the withdrawal</li>
          </ol>
          <Button
            onClick={() => window.open('https://skip.money', '_blank')}
            className="w-full bg-[#e6b951] hover:bg-[#d4a840] text-black"
          >
            Open Skip Go →
          </Button>
        </div>

        {/* Info */}
        <div className="space-y-2 pt-2 border-t border-[#463c25]">
          <p className="text-[#c6b795] text-xs">
            ⚠️ Withdrawals require ~0.5 DYDX token (~$1) for gas fees
          </p>
          <p className="text-[#c6b795] text-xs">
            ⏱️ Bridge time: 15-30 minutes depending on destination chain
          </p>
          <a 
            href="https://docs.skip.build" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[#e6b951] text-xs hover:underline"
          >
            Learn more about Skip Go
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
};
