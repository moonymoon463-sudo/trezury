import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Shield, Info } from 'lucide-react';

interface SnxAccountSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: (accountId: bigint) => void;
  chainId: number;
}

export const SnxAccountSetup = ({
  isOpen,
  onClose,
  onAccountCreated,
  chainId
}: SnxAccountSetupProps) => {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [gasInfo, setGasInfo] = useState<{ walletAddress: string; requiredGas: string; currentBalance: string } | null>(null);
  const { toast } = useToast();

  const handleCreateAccount = async () => {
    if (!password || password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Invalid Password',
        description: 'Please enter your wallet password (minimum 8 characters)'
      });
      return;
    }

    try {
      setLoading(true);
      
      // Call edge function to create Synthetix account
      const { data, error } = await supabase.functions.invoke('snx-trade-executor', {
        body: {
          operation: 'create_account',
          chainId,
          password
        }
      });
      // Handle response (data may be returned even when error is set)
      if (data?.success && data?.accountId) {
        toast({
          title: 'Account Created',
          description: `Synthetix trading account created successfully!`
        });
        setPassword('');
        setGasInfo(null);
        onAccountCreated(BigInt(data.accountId));
        onClose();
        return;
      }

      // Handle error path
      const errorPayload = (data as any) || { error: error?.message };

      if (errorPayload?.walletAddress && errorPayload?.requiredGas) {
        setGasInfo({
          walletAddress: errorPayload.walletAddress,
          requiredGas: errorPayload.requiredGas,
          currentBalance: errorPayload.currentBalance || '0'
        });
        toast({
          variant: 'destructive',
          title: 'Insufficient Gas',
          description: `Fund your internal wallet to continue. Required ~${errorPayload.requiredGas} ETH.`
        });
      } else {
        throw new Error(errorPayload?.error || 'Failed to create account');
      }
    } catch (error: any) {
      console.error('Account creation failed:', error);
      
      // Check if insufficient gas error
      const errorData = error.response?.data || error;
      if (errorData.walletAddress && errorData.requiredGas) {
        toast({
          variant: 'destructive',
          title: 'Insufficient Gas',
          description: (
            <div className="space-y-2">
              <p>Your internal wallet needs gas funds to create the trading account.</p>
              <p className="text-xs font-mono bg-background/50 p-2 rounded">
                {errorData.walletAddress}
              </p>
              <p className="text-xs">
                Required: {errorData.requiredGas} ETH
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(errorData.walletAddress);
                  toast({ title: 'Copied!', description: 'Wallet address copied to clipboard' });
                }}
                className="text-xs underline"
              >
                Copy address to fund wallet
              </button>
            </div>
          ) as any,
          duration: 10000
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Account Creation Failed',
          description: errorData.error || error.message || 'Failed to create Synthetix account'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Create Synthetix Trading Account
          </DialogTitle>
          <DialogDescription>
            Set up your Synthetix Perps V3 account to start trading
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2 text-sm">
                <p>• This creates an on-chain trading account for Synthetix Perps V3</p>
                <p>• One-time setup required (small gas fee)</p>
                <p>• Use your existing internal wallet - no new wallet needed</p>
                <p>• Trade with up to 50× leverage on select markets</p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="password">Wallet Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your wallet password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Use the same password you created when setting up your internal wallet
            </p>
          </div>

          <Button
            onClick={handleCreateAccount}
            disabled={loading || !password}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Trading Account'
            )}
          </Button>

          {gasInfo && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2 text-sm">
                  <p>Insufficient gas on your internal wallet to finalize account creation.</p>
                  <div className="text-xs font-mono bg-background/50 p-2 rounded break-all">
                    {gasInfo.walletAddress}
                  </div>
                  <p className="text-xs">Required: ~{gasInfo.requiredGas} ETH • Current: {gasInfo.currentBalance} ETH</p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(gasInfo.walletAddress);
                        toast({ title: 'Copied', description: 'Wallet address copied to clipboard' });
                      }}
                    >
                      Copy address
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Network: {chainId === 8453 ? 'Base' : chainId === 42161 ? 'Arbitrum' : 'Ethereum'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
