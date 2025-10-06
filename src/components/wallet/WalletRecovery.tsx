import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { secureWalletService } from '@/services/secureWalletService';
import { useToast } from '@/hooks/use-toast';

export function WalletRecovery() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [recoveredAddress, setRecoveredAddress] = useState<string | null>(null);

  const handleRecover = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to attempt wallet recovery',
        variant: 'destructive'
      });
      return;
    }

    if (!password) {
      toast({
        title: 'Password Required',
        description: 'Please enter your account password',
        variant: 'destructive'
      });
      return;
    }

    setRecovering(true);

    try {
      toast({
        title: 'Attempting Recovery',
        description: 'Trying legacy derivation methods...',
      });

      const privateKey = await secureWalletService.attemptLegacyRecovery(user.id, password);

      if (privateKey) {
        const { ethers } = await import('ethers');
        const wallet = new ethers.Wallet(privateKey);
        const address = wallet.address;

        setRecoveredAddress(address);
        
        toast({
          title: 'Recovery Successful!',
          description: `Found wallet: ${address}`,
        });

        // Ask user if they want to import it
        const shouldImport = window.confirm(
          `Recovered wallet: ${address}\n\nWould you like to import this wallet?`
        );

        if (shouldImport) {
          // Import the recovered wallet
          // This would call the import function from SecureWalletImport
          toast({
            title: 'Please Import',
            description: 'Use the Import Wallet feature to add this wallet to your account',
          });
        }
      } else {
        toast({
          title: 'Recovery Failed',
          description: 'Could not recover wallet with the provided password. The wallet may have been created with a different method.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Recovery failed:', error);
      toast({
        title: 'Recovery Error',
        description: error instanceof Error ? error.message : 'Failed to recover wallet',
        variant: 'destructive'
      });
    } finally {
      setRecovering(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Recover Legacy Wallet
        </CardTitle>
        <CardDescription>
          Attempt to recover an old wallet created with password-based derivation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!recoveredAddress ? (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will attempt to recover a wallet that was created using deterministic 
                password-based key derivation. If your wallet was created randomly, this won't work.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="recoveryPassword">Account Password</Label>
              <Input
                id="recoveryPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your account password"
              />
              <p className="text-xs text-muted-foreground">
                Enter the password you used when creating the original wallet
              </p>
            </div>

            <Button
              onClick={handleRecover}
              disabled={recovering || !password}
              className="w-full"
            >
              {recovering ? 'Attempting Recovery...' : 'Attempt Recovery'}
            </Button>

            <Alert>
              <AlertDescription className="text-xs">
                <strong>Note:</strong> This only works for wallets created with the old 
                deterministic method. Random wallets must be imported using their private key.
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Wallet Found!</strong><br />
              Address: {recoveredAddress}<br />
              <br />
              Please use the Import Wallet feature to add this wallet to your account.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}