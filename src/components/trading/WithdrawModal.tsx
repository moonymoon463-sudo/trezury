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
            Powered by Squid Router - Bridge USDC to any chain
          </DialogDescription>
        </DialogHeader>

        {/* Balance Display */}
        <div className="bg-[#211d12] p-4 rounded-lg border border-[#463c25] mb-4">
          <div className="text-[#c6b795] text-xs mb-1">Available Balance</div>
          <div className="text-white text-2xl font-bold">{availableBalance.toFixed(2)} USDC</div>
        </div>

        {/* Withdrawal Instructions */}
        <div className="bg-[#211d12] p-6 rounded-lg border border-[#463c25]">
          <h3 className="text-white font-semibold mb-3">⚡ Fast Cross-Chain Withdrawal via Squid Router</h3>
          <p className="text-[#c6b795] text-sm mb-4">
            Use Squid Router to withdraw USDC from dYdX to any supported chain in under 20 seconds.
          </p>
          <ol className="space-y-2 text-[#c6b795] text-sm mb-4">
            <li>1. Visit <a href="https://app.squidrouter.com" target="_blank" className="text-[#e6b951] underline">app.squidrouter.com</a></li>
            <li>2. Connect your dYdX wallet</li>
            <li>3. Select: dYdX Chain → Ethereum (or preferred chain)</li>
            <li>4. Amount: {availableBalance.toFixed(2)} USDC available</li>
            <li>5. Enter your destination address</li>
            <li>6. Complete the withdrawal</li>
          </ol>
          <Button
            onClick={() => window.open('https://app.squidrouter.com', '_blank')}
            className="w-full bg-[#e6b951] hover:bg-[#d4a840] text-black font-semibold"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Squid Router
          </Button>
        </div>

        {/* Info */}
        <div className="space-y-2 pt-2 border-t border-[#463c25]">
          <p className="text-[#c6b795] text-xs">
            ⚠️ Withdrawals require ~0.5 DYDX token (~$1) for gas fees
          </p>
          <p className="text-[#c6b795] text-xs">
            ⚡ Bridge time: &lt;20 seconds via Axelar GMP
          </p>
          <a 
            href="https://docs.squidrouter.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[#e6b951] text-xs hover:underline"
          >
            Learn more about Squid Router
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
};
