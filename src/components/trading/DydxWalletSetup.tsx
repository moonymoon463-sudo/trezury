import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, Copy, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dydxWalletService } from '@/services/dydxWalletService';
import { toast } from 'sonner';

export const DydxWalletSetup = ({ onComplete }: { onComplete?: () => void }) => {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [dydxAddress, setDydxAddress] = useState<string | null>(null);

  const handleCreateWallet = async () => {
    if (!user) {
      toast.error('Please sign in first');
      return;
    }

    if (!password || password.length < 12) {
      toast.error('Password must be at least 12 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setCreating(true);
      const address = await dydxWalletService.generateDydxWallet(user.id, password);
      setDydxAddress(address);
      setCreated(true);
      toast.success('dYdX trading wallet created successfully!');
      onComplete?.();
    } catch (error) {
      console.error('Error creating wallet:', error);
      toast.error('Failed to create wallet: ' + (error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const copyAddress = () => {
    if (dydxAddress) {
      navigator.clipboard.writeText(dydxAddress);
      toast.success('Address copied to clipboard');
    }
  };

  if (created && dydxAddress) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <CardTitle>Wallet Created Successfully</CardTitle>
          </div>
          <CardDescription>
            Your dYdX trading wallet is ready to use
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Your dYdX Address</Label>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 bg-muted p-3 rounded font-mono text-sm break-all">
                {dydxAddress}
              </div>
              <Button variant="outline" size="icon" onClick={copyAddress}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Your wallet is encrypted and stored securely. You'll need your password to trade.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create dYdX Trading Wallet</CardTitle>
        <CardDescription>
          Set up your Cosmos wallet for dYdX Chain trading
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1">Important:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>This creates a new Cosmos wallet (dydx1... address)</li>
              <li>Your wallet is encrypted with your password</li>
              <li>Keep your password safe - it cannot be recovered</li>
              <li>This is separate from your Ethereum wallet</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="password">Wallet Password</Label>
            <div className="relative mt-2">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter a strong password (12+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={creating}
                minLength={12}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={creating}
              className="mt-2"
            />
          </div>

          <Button
            onClick={handleCreateWallet}
            disabled={creating || !password || !confirmPassword}
            className="w-full"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Wallet...
              </>
            ) : (
              'Create Trading Wallet'
            )}
          </Button>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <p className="font-medium text-sm">What happens next:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>A 24-word recovery phrase is generated</li>
            <li>Your dYdX Chain address (dydx1...) is created</li>
            <li>Everything is encrypted with your password</li>
            <li>You can then deposit USDC and start trading</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
