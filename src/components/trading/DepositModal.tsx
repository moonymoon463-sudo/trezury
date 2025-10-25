import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, Copy, ExternalLink, Wallet, Shield } from 'lucide-react';
import { ethers } from 'ethers';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  dydxAddress: string;
  internalAddress?: string;
  externalAddress?: string;
  onDepositComplete: () => void;
}

export const DepositModal = ({
  isOpen,
  onClose,
  dydxAddress,
  internalAddress,
  externalAddress,
  onDepositComplete
}: DepositModalProps) => {
  const [activeTab, setActiveTab] = useState<'internal' | 'external' | 'bridge'>('internal');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { balances } = useWalletBalance();

  const usdcBalance = balances.find(b => b.asset === 'USDC')?.amount || 0;

  const handleInternalTransfer = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount'
      });
      return;
    }

    if (parseFloat(amount) > usdcBalance) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Balance',
        description: `You only have ${usdcBalance.toFixed(2)} USDC available`
      });
      return;
    }

    if (!password) {
      toast({
        variant: 'destructive',
        title: 'Password Required',
        description: 'Please enter your wallet password'
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('transfer-to-dydx', {
        body: {
          amount: parseFloat(amount),
          password,
          destinationAddress: dydxAddress
        }
      });

      if (error) throw error;

      toast({
        title: 'Transfer Initiated',
        description: `Bridging ${amount} USDC to dYdX. This may take 15-30 minutes.`
      });

      setAmount('');
      setPassword('');
      onDepositComplete();
      onClose();
    } catch (error: any) {
      console.error('Transfer failed:', error);
      toast({
        variant: 'destructive',
        title: 'Transfer Failed',
        description: error.message || 'Failed to initiate transfer'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExternalTransfer = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount'
      });
      return;
    }

    if (!window.ethereum) {
      toast({
        variant: 'destructive',
        title: 'MetaMask Not Found',
        description: 'Please install MetaMask to continue'
      });
      return;
    }

    try {
      setLoading(true);

      // For now, just show instructions for manual bridge
      toast({
        title: 'External Transfer',
        description: 'Please use the Bridge tab to transfer from your external wallet'
      });
    } catch (error: any) {
      console.error('External transfer failed:', error);
      toast({
        variant: 'destructive',
        title: 'Transfer Failed',
        description: error.message || 'Failed to initiate transfer'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(dydxAddress);
    toast({
      title: 'Address Copied',
      description: 'dYdX address copied to clipboard'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Deposit to Trading Wallet</DialogTitle>
          <DialogDescription>
            Transfer USDC to your dYdX trading wallet to start trading
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="internal" disabled={!internalAddress}>
              <Shield className="h-4 w-4 mr-2" />
              Internal
            </TabsTrigger>
            <TabsTrigger value="external" disabled={!externalAddress}>
              <Wallet className="h-4 w-4 mr-2" />
              External
            </TabsTrigger>
            <TabsTrigger value="bridge">
              <ExternalLink className="h-4 w-4 mr-2" />
              Bridge
            </TabsTrigger>
          </TabsList>

          {/* Internal Wallet Transfer */}
          <TabsContent value="internal" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Transfer USDC from your internal Trezury wallet to your dYdX trading account
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label>Available Balance</Label>
                <div className="text-2xl font-bold">{usdcBalance.toFixed(2)} USDC</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal-amount">Amount (USDC)</Label>
                <Input
                  id="internal-amount"
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
                  onClick={() => setAmount(usdcBalance.toString())}
                  className="text-xs"
                >
                  Use Max
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal-password">Wallet Password</Label>
                <Input
                  id="internal-password"
                  type="password"
                  placeholder="Enter your wallet password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">Bridge Time: 15-30 minutes</p>
                  <p className="text-sm">Your funds will be bridged via CCTP to dYdX Chain</p>
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleInternalTransfer}
                disabled={loading || !amount || !password}
                className="w-full"
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Transfer to dYdX
              </Button>
            </div>
          </TabsContent>

          {/* External Wallet Transfer */}
          <TabsContent value="external" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                For external wallet transfers, please use the Bridge tab or your preferred bridge service
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label>Connected Wallet</Label>
                <div className="font-mono text-sm">
                  {externalAddress?.slice(0, 6)}...{externalAddress?.slice(-4)}
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setActiveTab('bridge')}
              >
                Go to Bridge Instructions
              </Button>
            </div>
          </TabsContent>

          {/* Bridge Instructions */}
          <TabsContent value="bridge" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Use Coinbase (recommended) or bridge USDC from Ethereum/Arbitrum
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label>Your dYdX Address</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted p-3 rounded font-mono text-xs break-all">
                    {dydxAddress}
                  </div>
                  <Button variant="outline" size="icon" onClick={copyAddress}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p className="font-medium text-sm">Option 1: Coinbase (Fastest)</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Open Coinbase app and go to Send</li>
                    <li>Select USDC and enter amount</li>
                    <li>Paste your dYdX address above</li>
                    <li>Confirm - funds arrive in 2-5 minutes</li>
                  </ol>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open('https://www.coinbase.com/send-and-receive', '_blank')}
                  >
                    Open Coinbase <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p className="font-medium text-sm">Option 2: Bridge from Ethereum/Arbitrum</p>
                  <p className="text-sm text-muted-foreground">
                    Use Skip Go bridge with CCTP (15-30 min bridge time)
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open('https://app.skip.build/', '_blank')}
                  >
                    Open Skip Go Bridge <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Only send USDC to this address</li>
                    <li>Minimum: $10 USDC recommended</li>
                    <li>For withdrawals, you'll need 0.5 DYDX tokens for gas (~$1)</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
