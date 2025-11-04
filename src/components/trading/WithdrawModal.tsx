import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradingWalletAddress: string;
  availableBalance: number;
  internalAddress?: string;
  onWithdrawComplete: () => void;
}

const SUPPORTED_CHAINS = [
  { id: '1', name: 'Ethereum', usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { id: '10', name: 'Optimism', usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
  { id: '8453', name: 'Base', usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { id: '137', name: 'Polygon', usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
];

export const WithdrawModal = ({
  isOpen,
  onClose,
  tradingWalletAddress,
  availableBalance,
  internalAddress,
  onWithdrawComplete
}: WithdrawModalProps) => {
  const [amount, setAmount] = useState('');
  const [destinationChain, setDestinationChain] = useState('1');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [useInternalWallet, setUseInternalWallet] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Please enter a valid withdrawal amount'
      });
      return;
    }

    if (!password) {
      toast({
        variant: 'destructive',
        title: 'Password Required',
        description: 'Please enter your trading wallet password'
      });
      return;
    }

    const finalDestination = useInternalWallet && internalAddress ? internalAddress : destinationAddress;
    if (!finalDestination || !/^0x[a-fA-F0-9]{40}$/.test(finalDestination)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Address',
        description: 'Please enter a valid EVM address'
      });
      return;
    }

    setLoading(true);

    try {
      const selectedChain = SUPPORTED_CHAINS.find(c => c.id === destinationChain);
      
      const { data, error } = await supabase.functions.invoke('hyperliquid-withdraw', {
        body: {
          amount: parseFloat(amount),
          password,
          destinationChain,
          destinationAddress: finalDestination,
          destinationToken: selectedChain?.usdc
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Withdrawal Initiated',
          description: `Withdrawing ${amount} USDC to ${selectedChain?.name}. Estimated time: ${data.estimatedTime}s`
        });
        
        setAmount('');
        setDestinationAddress('');
        setPassword('');
        onWithdrawComplete();
        onClose();
      } else {
        throw new Error(data?.message || 'Withdrawal failed');
      }
    } catch (err: any) {
      console.error('[WithdrawModal] Error:', err);
      toast({
        variant: 'destructive',
        title: 'Withdrawal Failed',
        description: err.message || 'Failed to process withdrawal'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMaxAmount = () => {
    setAmount(availableBalance.toFixed(2));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#2a251a] border-[#463c25]">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">Withdraw from Trading Wallet</DialogTitle>
          <DialogDescription className="text-[#c6b795]">
            Bridge USDC to any supported chain via Squid Router
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Available Balance */}
          <div className="bg-[#211d12] p-3 rounded-lg border border-[#463c25]">
            <div className="text-[#c6b795] text-xs mb-1">Available Balance</div>
            <div className="text-white text-2xl font-bold">{availableBalance.toFixed(2)} USDC</div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-[#c6b795] text-sm">Amount (USDC)</Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-[#211d12] border-[#463c25] text-white flex-1"
              />
              <Button
                onClick={handleMaxAmount}
                variant="outline"
                className="bg-[#463c25] border-[#463c25] text-white hover:bg-[#5a4d30]"
              >
                Max
              </Button>
            </div>
          </div>

          {/* Destination Chain */}
          <div className="space-y-2">
            <Label htmlFor="chain" className="text-[#c6b795] text-sm">Destination Chain</Label>
            <Select value={destinationChain} onValueChange={setDestinationChain}>
              <SelectTrigger className="bg-[#211d12] border-[#463c25] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2a251a] border-[#463c25]">
                {SUPPORTED_CHAINS.map(chain => (
                  <SelectItem key={chain.id} value={chain.id} className="text-white hover:bg-[#463c25]">
                    {chain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination Address */}
          <div className="space-y-2">
            <Label htmlFor="address" className="text-[#c6b795] text-sm">Destination Address</Label>
            {internalAddress && (
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="use-internal"
                  checked={useInternalWallet}
                  onChange={(e) => setUseInternalWallet(e.target.checked)}
                  className="rounded border-[#463c25]"
                />
                <label htmlFor="use-internal" className="text-[#c6b795] text-sm cursor-pointer">
                  Use my internal wallet ({internalAddress.slice(0, 6)}...{internalAddress.slice(-4)})
                </label>
              </div>
            )}
            <Input
              id="address"
              placeholder="0x..."
              value={useInternalWallet && internalAddress ? internalAddress : destinationAddress}
              onChange={(e) => {
                setUseInternalWallet(false);
                setDestinationAddress(e.target.value);
              }}
              disabled={useInternalWallet && !!internalAddress}
              className="bg-[#211d12] border-[#463c25] text-white"
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#c6b795] text-sm">Trading Wallet Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#211d12] border-[#463c25] text-white"
            />
          </div>

          {/* Info Alert */}
          <Alert className="bg-[#211d12] border-[#463c25]">
            <AlertCircle className="h-4 w-4 text-[#e6b951]" />
            <AlertDescription className="text-[#c6b795] text-xs">
              Bridge time: ~20 seconds via Squid Router. Small gas fees apply.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 bg-transparent border-[#463c25] text-[#c6b795] hover:bg-[#463c25]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={loading}
              className="flex-1 bg-[#e6b951] hover:bg-[#d4a840] text-black font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Withdraw
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
