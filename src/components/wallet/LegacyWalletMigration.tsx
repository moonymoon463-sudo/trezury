import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Lock, CheckCircle } from 'lucide-react';
import { useWalletMigration } from '@/hooks/useWalletMigration';
import { useToast } from '@/hooks/use-toast';

export const LegacyWalletMigration = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { checkNeedsMigration, migrateWallet } = useWalletMigration();
  const { toast } = useToast();
  const [needsMigration, setNeedsMigration] = useState<boolean | null>(null);
  const [migrationComplete, setMigrationComplete] = useState(false);

  const handleCheckMigration = async () => {
    const needs = await checkNeedsMigration();
    setNeedsMigration(needs);
  };

  const handleMigrate = async () => {
    if (!password || password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Invalid Input',
        description: 'Passwords must match and not be empty'
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Weak Password',
        description: 'Password must be at least 8 characters'
      });
      return;
    }

    try {
      setIsProcessing(true);
      await migrateWallet(password);
      
      setMigrationComplete(true);
      toast({
        title: 'Migration Successful! 🎉',
        description: 'Your wallet is now secured with your password'
      });
      
      // Clear sensitive data
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Migration failed:', error);
      toast({
        variant: 'destructive',
        title: 'Migration Failed',
        description: error instanceof Error ? error.message : 'Failed to migrate wallet'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (needsMigration === null) {
    return (
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-yellow-500" />
            <CardTitle>Wallet Security Update</CardTitle>
          </div>
          <CardDescription>
            Check if your wallet needs a security upgrade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCheckMigration} className="w-full">
            Check Wallet Security
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!needsMigration) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <CardTitle>Wallet Security: Up to Date</CardTitle>
          </div>
          <CardDescription>
            Your wallet is using the latest security standards
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (migrationComplete) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <CardTitle>Migration Complete! 🎉</CardTitle>
          </div>
          <CardDescription>
            Your wallet is now secured with password-based encryption
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Your wallet private key is now encrypted with your password. Make sure to remember it - we cannot recover lost passwords.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <CardTitle>Security Upgrade Required</CardTitle>
        </div>
        <CardDescription>
          Your wallet uses legacy encryption. Migrate to password-based security.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-yellow-500/30 bg-yellow-500/5">
          <Shield className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-sm">
            <p className="font-semibold mb-2">Why migrate?</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Legacy encryption is less secure</li>
              <li>Password-based encryption gives you full control</li>
              <li>Required for production use</li>
              <li>One-time migration, takes seconds</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div>
            <Label htmlFor="migrate-password" className="text-sm">
              New Wallet Password
            </Label>
            <Input
              id="migrate-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a strong password"
              className="mt-2"
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use your account password or create a unique wallet password
            </p>
          </div>

          <div>
            <Label htmlFor="confirm-password" className="text-sm">
              Confirm Password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className="mt-2"
              disabled={isProcessing}
            />
          </div>

          <Alert className="border-red-500/30 bg-red-500/5">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-xs">
              <strong>Warning:</strong> If you lose this password, you will lose access to your wallet. We cannot recover it for you.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleMigrate}
            disabled={isProcessing || !password || password !== confirmPassword}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Lock className="mr-2 h-4 w-4 animate-pulse" />
                Migrating Wallet...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Migrate to Secure Wallet
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};