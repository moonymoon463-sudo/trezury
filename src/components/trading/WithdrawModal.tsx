import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, Shield, Wallet } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleWithdrawToInternal = async () => {
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

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('withdraw-from-dydx', {
        body: {
          amount: parseFloat(amount),
          password,
          destinationAddress: internalAddress,
          destinationType: 'internal'
        }
      });

      if (error) throw error;

      toast({
        title: 'Withdrawal Initiated',
        description: `Withdrawing ${amount} USDC to your internal wallet. This may take 15-30 minutes.`
      });

      setAmount('');
      setPassword('');
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

  const handleWithdrawToExternal = async () => {
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

    if (!destinationAddress || !destinationAddress.startsWith('0x')) {
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
          destinationAddress,
          destinationType: 'external'
        }
      });

      if (error) throw error;

      toast({
        title: 'Withdrawal Initiated',
        description: `Withdrawing ${amount} USDC to ${destinationAddress.slice(0, 6)}...${destinationAddress.slice(-4)}. This may take 15-30 minutes.`
      });

      setAmount('');
      setPassword('');
      setDestinationAddress('');
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Withdraw from Trading Wallet</DialogTitle>
          <DialogDescription>
            Withdraw USDC from your dYdX trading wallet
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1">Important: Gas Requirement</p>
            <p className="text-sm">
              Withdrawals require 0.5 DYDX tokens (~$1) for gas fees. Make sure you have DYDX tokens in your trading wallet.
            </p>
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="internal" disabled={!internalAddress}>
              <Shield className="h-4 w-4 mr-2" />
              To Internal Wallet
            </TabsTrigger>
            <TabsTrigger value="external">
              <Wallet className="h-4 w-4 mr-2" />
              To External Address
            </TabsTrigger>
          </TabsList>

          {/* Withdraw to Internal Wallet */}
          <TabsContent value="internal" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Available Balance</Label>
                <div className="text-2xl font-bold">{availableBalance.toFixed(2)} USDC</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal-withdraw-amount">Amount (USDC)</Label>
                <Input
                  id="internal-withdraw-amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAmount(availableBalance.toString())}
                  className="text-xs"
                >
                  Withdraw Max
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal-withdraw-password">Trading Password</Label>
                <Input
                  id="internal-withdraw-password"
                  type="password"
                  placeholder="Enter your trading password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Destination:</strong> Your Internal Trezury Wallet
                </p>
                <p className="text-xs font-mono mt-1">
                  {internalAddress?.slice(0, 12)}...{internalAddress?.slice(-8)}
                </p>
              </div>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">Bridge Time: 15-30 minutes</p>
                  <p className="text-sm">Funds will be bridged via CCTP to Ethereum/Base</p>
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleWithdrawToInternal}
                disabled={loading || !amount || !password}
                className="w-full"
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Withdraw to Internal Wallet
              </Button>
            </div>
          </TabsContent>

          {/* Withdraw to External Address */}
          <TabsContent value="external" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Available Balance</Label>
                <div className="text-2xl font-bold">{availableBalance.toFixed(2)} USDC</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="external-withdraw-amount">Amount (USDC)</Label>
                <Input
                  id="external-withdraw-amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAmount(availableBalance.toString())}
                  className="text-xs"
                >
                  Withdraw Max
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination-address">Destination Address (Ethereum)</Label>
                <Input
                  id="destination-address"
                  type="text"
                  placeholder="0x..."
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Must be a valid Ethereum address. USDC will be sent to Ethereum mainnet.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="external-withdraw-password">Trading Password</Label>
                <Input
                  id="external-withdraw-password"
                  type="password"
                  placeholder="Enter your trading password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">Bridge Time: 15-30 minutes</p>
                  <p className="text-sm">Funds will be bridged via CCTP to Ethereum mainnet</p>
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleWithdrawToExternal}
                disabled={loading || !amount || !password || !destinationAddress}
                className="w-full"
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Withdraw to External Address
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
