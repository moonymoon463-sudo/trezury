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

      if (error) throw error;

      if (data?.success && data?.accountId) {
        toast({
          title: 'Account Created',
          description: `Synthetix trading account created successfully!`
        });
        setPassword(''); // Clear password
        onAccountCreated(BigInt(data.accountId));
        onClose();
      } else {
        throw new Error(data?.error || 'Failed to create account');
      }
    } catch (error: any) {
      console.error('Account creation failed:', error);
      toast({
        variant: 'destructive',
        title: 'Account Creation Failed',
        description: error.message || 'Failed to create Synthetix account'
      });
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

          <p className="text-xs text-muted-foreground text-center">
            Network: {chainId === 8453 ? 'Base' : chainId === 42161 ? 'Arbitrum' : 'Ethereum'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
