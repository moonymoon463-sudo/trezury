import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface WalletTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: {
    type: 'evm' | 'dydx' | 'internal';
    address: string;
    balance: number;
    label: string;
  }[];
  onTransferComplete?: () => void;
}

export const WalletTransferModal = ({
  open,
  onOpenChange,
  wallets,
  onTransferComplete
}: WalletTransferModalProps) => {
  const [fromWallet, setFromWallet] = useState<string>('');
  const [toWallet, setToWallet] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const selectedFrom = wallets.find(w => w.address === fromWallet);
  const selectedTo = wallets.find(w => w.address === toWallet);

  const handleTransfer = async () => {
    if (!fromWallet || !toWallet || !amount || !password) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill in all fields'
      });
      return;
    }

    if (fromWallet === toWallet) {
      toast({
        variant: 'destructive',
        title: 'Invalid Transfer',
        description: 'Cannot transfer to the same wallet'
      });
      return;
    }

    const transferAmount = parseFloat(amount);
    if (transferAmount <= 0 || transferAmount > (selectedFrom?.balance || 0)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Transfer amount exceeds available balance'
      });
      return;
    }

    try {
      setLoading(true);

      // Call edge function to handle cross-wallet transfer
      const { data, error } = await supabase.functions.invoke('transfer-between-wallets', {
        body: {
          fromAddress: fromWallet,
          toAddress: toWallet,
          amount: transferAmount,
          password
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Transfer Initiated',
          description: `Transferring $${transferAmount.toFixed(2)} USDC`,
        });

        onTransferComplete?.();
        onOpenChange(false);
        
        // Reset form
        setFromWallet('');
        setToWallet('');
        setAmount('');
        setPassword('');
      } else {
        throw new Error(data?.error || 'Transfer failed');
      }
    } catch (error) {
      console.error('Transfer error:', error);
      toast({
        variant: 'destructive',
        title: 'Transfer Failed',
        description: error instanceof Error ? error.message : 'Failed to initiate transfer'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#2a251a] border-[#463c25]">
        <DialogHeader>
          <DialogTitle className="text-white">Transfer Between Wallets</DialogTitle>
          <DialogDescription className="text-[#c6b795]">
            Move funds between your wallets securely
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* From Wallet */}
          <div className="space-y-2">
            <Label htmlFor="from" className="text-white">From Wallet</Label>
            <Select value={fromWallet} onValueChange={setFromWallet}>
              <SelectTrigger className="bg-[#211d12] border-[#463c25] text-white">
                <SelectValue placeholder="Select source wallet" />
              </SelectTrigger>
              <SelectContent className="bg-[#2a251a] border-[#463c25]">
                {wallets.map((wallet) => (
                  <SelectItem key={wallet.address} value={wallet.address} className="text-white">
                    {wallet.label} - ${wallet.balance.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedFrom && (
              <p className="text-xs text-[#c6b795]">
                Available: ${selectedFrom.balance.toFixed(2)} USDC
              </p>
            )}
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="h-6 w-6 text-[#e6b951]" />
          </div>

          {/* To Wallet */}
          <div className="space-y-2">
            <Label htmlFor="to" className="text-white">To Wallet</Label>
            <Select value={toWallet} onValueChange={setToWallet}>
              <SelectTrigger className="bg-[#211d12] border-[#463c25] text-white">
                <SelectValue placeholder="Select destination wallet" />
              </SelectTrigger>
              <SelectContent className="bg-[#2a251a] border-[#463c25]">
                {wallets
                  .filter(w => w.address !== fromWallet)
                  .map((wallet) => (
                    <SelectItem key={wallet.address} value={wallet.address} className="text-white">
                      {wallet.label} - ${wallet.balance.toFixed(2)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-white">Amount (USDC)</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                max={selectedFrom?.balance || 0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-[#211d12] border-[#463c25] text-white pr-16"
                placeholder="0.00"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-[#e6b951] hover:text-white"
                onClick={() => setAmount(selectedFrom?.balance.toString() || '0')}
              >
                Max
              </Button>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white">Wallet Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#211d12] border-[#463c25] text-white"
              placeholder="Enter your wallet password"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 border-[#463c25] text-[#c6b795] hover:bg-[#463c25]/50"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            className="flex-1 bg-[#e6b951] hover:bg-[#d4a840] text-black font-bold"
            disabled={loading || !fromWallet || !toWallet || !amount || !password}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              'Transfer'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
