import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, ExternalLink, AlertCircle, CheckCircle2, Loader2, QrCode } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dydxWalletService } from '@/services/dydxWalletService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DepositUSDCProps {
  onDepositComplete?: (balance: number) => void;
}

export const DepositUSDC = ({ onDepositComplete }: DepositUSDCProps) => {
  const { user } = useAuth();
  const [dydxAddress, setDydxAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [depositStatus, setDepositStatus] = useState<'none' | 'pending' | 'complete'>('none');

  useEffect(() => {
    loadWalletAndBalance();
  }, [user]);

  const loadWalletAndBalance = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const address = await dydxWalletService.getDydxAddress(user.id);
      setDydxAddress(address);

      if (address) {
        await checkBalance(address);
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkBalance = async (address: string) => {
    try {
      setChecking(true);
      const { data, error } = await supabase.functions.invoke('check-dydx-balance', {
        body: { dydxAddress: address }
      });

      if (error) throw error;

      const balance = parseFloat(data?.usdc || '0');
      setUsdcBalance(balance);

      if (balance > 0) {
        setDepositStatus('complete');
        onDepositComplete?.(balance);
      }
    } catch (error) {
      console.error('Error checking balance:', error);
    } finally {
      setChecking(false);
    }
  };

  const copyAddress = () => {
    if (dydxAddress) {
      navigator.clipboard.writeText(dydxAddress);
      toast.success('Address copied to clipboard');
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!dydxAddress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Setup Required</CardTitle>
          <CardDescription>
            You need to create a dYdX trading account first
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please complete wallet setup before depositing funds
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Fund Your Trading Account</CardTitle>
            <CardDescription>
              Deposit USDC to start trading on dYdX
            </CardDescription>
          </div>
          <Badge variant={depositStatus === 'complete' ? 'default' : 'secondary'}>
            {depositStatus === 'complete' ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" /> Funded</>
            ) : (
              <>Awaiting Deposit</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Balance */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold">${usdcBalance.toFixed(2)} USDC</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dydxAddress && checkBalance(dydxAddress)}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
        </div>

        {/* Deposit Methods */}
        <Tabs defaultValue="coinbase" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="coinbase">Coinbase (Recommended)</TabsTrigger>
            <TabsTrigger value="bridge">Bridge USDC</TabsTrigger>
          </TabsList>

          {/* Coinbase Direct Deposit */}
          <TabsContent value="coinbase" className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Coinbase automatically routes USDC to dYdX Chain - easiest method!
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Your dYdX Address</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted p-3 rounded font-mono text-sm break-all">
                    {dydxAddress}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyAddress}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <p className="font-medium text-sm">Instructions:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Open Coinbase and navigate to Send</li>
                  <li>Select USDC and enter the amount</li>
                  <li>Paste your dYdX address above</li>
                  <li>Confirm and send - funds arrive in ~2-5 minutes</li>
                </ol>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open('https://www.coinbase.com/send-and-receive', '_blank')}
              >
                Open Coinbase <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </TabsContent>

          {/* Bridge from Ethereum/Arbitrum */}
          <TabsContent value="bridge" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Bridge USDC from Ethereum or Arbitrum using CCTP (Circle's Cross-Chain Transfer Protocol)
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Your dYdX Address</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted p-3 rounded font-mono text-sm break-all">
                    {formatAddress(dydxAddress)}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyAddress}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={() => window.open('https://app.skip.build/', '_blank')}
                >
                  Use Skip Go (CCTP Bridge) <ExternalLink className="h-4 w-4 ml-2" />
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Bridge time: 15-30 minutes | Supported chains: Ethereum, Arbitrum
                </p>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <p className="font-medium text-sm">Bridge Steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Connect your Ethereum wallet to Skip Go</li>
                  <li>Select source chain (Ethereum/Arbitrum) and USDC</li>
                  <li>Select destination: dYdX Chain</li>
                  <li>Paste your dYdX address above</li>
                  <li>Confirm transaction and wait for bridge completion</li>
                </ol>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Important Notes */}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1">Important:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Only send USDC to this address</li>
              <li>Minimum deposit: $10 USDC recommended</li>
              <li>For withdrawals, you'll need 0.5 DYDX tokens for gas (~$1)</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
