import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowRight, DollarSign } from 'lucide-react';

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
  const [destination, setDestination] = useState<'internal' | 'external'>('internal');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [externalAddress, setExternalAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount'
      });
      return;
    }

    if (parseFloat(amount) > availableBalance) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Balance',
        description: `You only have ${availableBalance.toFixed(2)} USDC available`
      });
      return;
    }

    if (!password) {
      toast({
        variant: 'destructive',
        title: 'Password Required',
        description: 'Please enter your trading password'
      });
      return;
    }

    const targetAddress = destination === 'internal' ? internalAddress : externalAddress;
    
    if (!targetAddress) {
      toast({
        variant: 'destructive',
        title: 'Address Required',
        description: destination === 'internal' ? 'Internal wallet address not found' : 'Please enter a destination address'
      });
      return;
    }

    if (destination === 'external' && !targetAddress.startsWith('0x')) {
      toast({
        variant: 'destructive',
        title: 'Invalid Address',
        description: 'Please enter a valid Ethereum address'
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('withdraw-from-dydx', {
        body: {
          amount: parseFloat(amount),
          password,
          destinationAddress: targetAddress,
          destinationType: destination
        }
      });

      if (error) throw error;

      toast({
        title: 'Withdrawal Initiated',
        description: `Withdrawing ${amount} USDC to your ${destination} wallet`
      });

      setAmount('');
      setPassword('');
      setExternalAddress('');
      onWithdrawComplete();
      onClose();
    } catch (error: any) {
      console.error('Withdrawal failed:', error);
      toast({
        variant: 'destructive',
        title: 'Withdrawal Failed',
        description: error.message || 'Failed to initiate withdrawal'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-[#2a251a] border-[#463c25]">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">Withdraw from Trading Wallet</DialogTitle>
          <DialogDescription className="text-[#c6b795]">
            Transfer USDC from your trading wallet to your chosen destination
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Destination Wallet Selection */}
          <div className="space-y-3">
            <Label className="text-[#c6b795] text-sm font-medium">To Wallet</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDestination('internal')}
                disabled={!internalAddress}
                className={`p-4 rounded-lg border-2 transition-all ${
                  destination === 'internal'
                    ? 'border-[#e6b951] bg-[#e6b951]/10'
                    : 'border-[#463c25] bg-[#211d12] hover:border-[#635636]'
                } ${!internalAddress ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-white font-semibold mb-1">Internal Wallet</div>
                <div className="text-[#c6b795] text-xs">
                  {internalAddress ? `${internalAddress.slice(0, 6)}...${internalAddress.slice(-4)}` : 'Not available'}
                </div>
              </button>
              
              <button
                onClick={() => setDestination('external')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  destination === 'external'
                    ? 'border-[#e6b951] bg-[#e6b951]/10'
                    : 'border-[#463c25] bg-[#211d12] hover:border-[#635636]'
                }`}
              >
                <div className="text-white font-semibold mb-1">External Wallet</div>
                <div className="text-[#c6b795] text-xs">
                  Custom address
                </div>
              </button>
            </div>
          </div>

          {/* Flow Indicator */}
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="text-white text-sm font-semibold">Trading Wallet</div>
            <ArrowRight className="h-5 w-5 text-[#e6b951]" />
            <div className="text-[#c6b795] text-sm font-medium">
              {destination === 'internal' ? 'Internal' : 'External'}
            </div>
          </div>

          {/* Available Balance */}
          <div className="bg-[#211d12] p-4 rounded-lg border border-[#463c25]">
            <div className="text-[#c6b795] text-xs mb-1">Available Balance</div>
            <div className="text-white text-2xl font-bold">{availableBalance.toFixed(2)} USDC</div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount" className="text-[#c6b795] text-sm font-medium">
              Amount (USDC)
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c6b795]" />
              <Input
                id="withdraw-amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
                className="pl-9 bg-[#211d12] border-[#463c25] text-white placeholder:text-[#c6b795]/50 focus:border-[#e6b951]"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAmount(availableBalance.toString())}
              className="text-[#e6b951] hover:text-white hover:bg-[#463c25] text-xs"
            >
              Withdraw Max ({availableBalance.toFixed(2)} USDC)
            </Button>
          </div>

          {/* External Address Input (only for external) */}
          {destination === 'external' && (
            <div className="space-y-2">
              <Label htmlFor="external-address" className="text-[#c6b795] text-sm font-medium">
                Destination Address (Ethereum)
              </Label>
              <Input
                id="external-address"
                type="text"
                placeholder="0x..."
                value={externalAddress}
                onChange={(e) => setExternalAddress(e.target.value)}
                className="bg-[#211d12] border-[#463c25] text-white placeholder:text-[#c6b795]/50 focus:border-[#e6b951] font-mono text-sm"
              />
            </div>
          )}

          {/* Password Input */}
          <div className="space-y-2">
            <Label htmlFor="withdraw-password" className="text-[#c6b795] text-sm font-medium">
              Trading Password
            </Label>
            <Input
              id="withdraw-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#211d12] border-[#463c25] text-white placeholder:text-[#c6b795]/50 focus:border-[#e6b951]"
            />
          </div>

          {/* Action Button */}
          <Button
            onClick={handleWithdraw}
            disabled={loading || !amount || !password || (destination === 'external' && !externalAddress)}
            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold text-base"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Withdraw {amount || '0.00'} USDC
              </>
            )}
          </Button>

          {/* Info Text */}
          <p className="text-[#c6b795] text-xs text-center">
            Bridge time: 15-30 minutes via CCTP. Requires 0.5 DYDX (~$1) for gas.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
