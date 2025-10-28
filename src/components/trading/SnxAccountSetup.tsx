import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SnxAccountSetupProps {
  chainId: number;
  onAccountCreated: (accountId: string) => void;
}

export const SnxAccountSetup = ({ chainId, onAccountCreated }: SnxAccountSetupProps) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [gasInfo, setGasInfo] = useState<{
    walletAddress: string;
    requiredGas: string;
    currentBalance: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const chainName = chainId === 8453 ? 'Base' : chainId === 42161 ? 'Arbitrum' : 'Ethereum';

  const handleCreateAccount = async () => {
    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setGasInfo(null);

    try {
      const { data, error } = await supabase.functions.invoke('snx-trade-executor', {
        body: {
          operation: 'create_account',
          chainId,
          password
        }
      });

      if (error) throw error;

      if (!data.success) {
        // Check for insufficient gas
        if (data.walletAddress && data.requiredGas) {
          setGasInfo({
            walletAddress: data.walletAddress,
            requiredGas: data.requiredGas,
            currentBalance: data.currentBalance
          });
          toast.error('Insufficient Gas', {
            description: 'Please fund your internal wallet to create an account'
          });
          return;
        }

        throw new Error(data.error || 'Account creation failed');
      }

      toast.success('Trading Account Created!', {
        description: `Account ID: ${data.accountId}`
      });
      
      onAccountCreated(data.accountId);
    } catch (err) {
      console.error('[SnxAccountSetup] Error:', err);
      toast.error(err instanceof Error ? err.message : 'Account creation failed');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (gasInfo?.walletAddress) {
      navigator.clipboard.writeText(gasInfo.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Address copied to clipboard');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Trading Account</CardTitle>
        <CardDescription>
          Set up your Synthetix Perps V3 trading account on {chainName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Wallet Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your wallet password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateAccount()}
          />
          <p className="text-xs text-muted-foreground">
            Use the same password as your secure wallet
          </p>
        </div>

        {gasInfo && (
          <Alert>
            <AlertDescription className="space-y-2">
              <p className="font-semibold">⛽ Insufficient Gas Funds</p>
              <p className="text-sm">
                Your internal wallet needs {gasInfo.requiredGas} ETH to create an account.
                Current balance: {gasInfo.currentBalance} ETH
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                  {gasInfo.walletAddress}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyAddress}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Send ETH to this address, then try again
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleCreateAccount}
          disabled={loading || !password}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            'Create Trading Account'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
