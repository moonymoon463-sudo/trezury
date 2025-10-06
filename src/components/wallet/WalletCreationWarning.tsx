import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { secureWalletService } from '@/services/secureWalletService';

interface WalletCreationWarningProps {
  onProceed: () => void;
  onCancel: () => void;
}

export function WalletCreationWarning({ onProceed, onCancel }: WalletCreationWarningProps) {
  const { user } = useAuth();
  const [existingWallets, setExistingWallets] = useState<Array<{ address: string; balance: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState('');

  useEffect(() => {
    const checkExistingWallets = async () => {
      if (!user) return;

      try {
        const wallets = await secureWalletService.getAllWallets(user.id);
        
        const walletsWithBalances = await Promise.all(
          wallets
            .filter(w => w.status === 'active')
            .map(async (wallet) => {
              const balance = await secureWalletService.checkWalletBalance(wallet.address);
              return { address: wallet.address, balance };
            })
        );

        setExistingWallets(walletsWithBalances.filter(w => w.balance > 0));
      } catch (error) {
        console.error('Failed to check existing wallets:', error);
      } finally {
        setLoading(false);
      }
    };

    checkExistingWallets();
  }, [user]);

  if (loading) {
    return (
      <Alert>
        <AlertDescription>Checking existing wallets...</AlertDescription>
      </Alert>
    );
  }

  if (existingWallets.length === 0) {
    // No wallets with funds, can proceed
    onProceed();
    return null;
  }

  const hasTypedCorrectly = typedConfirmation.toLowerCase() === 'i understand';

  return (
    <Alert variant="destructive" className="space-y-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>⚠️ Critical: Existing Wallet Has Funds</AlertTitle>
      <AlertDescription className="space-y-4">
        <p className="font-semibold">
          You have {existingWallets.length} wallet(s) with funds:
        </p>
        
        {existingWallets.map((wallet) => (
          <div key={wallet.address} className="p-3 bg-destructive/10 rounded border border-destructive/30">
            <p className="font-mono text-sm">{wallet.address}</p>
            <p className="text-sm font-semibold mt-1">Balance: ${wallet.balance.toFixed(2)}</p>
          </div>
        ))}

        <p className="text-sm">
          Creating a new wallet without backing up your private key will make these funds <strong>permanently inaccessible</strong>.
        </p>

        <div className="space-y-3 pt-2">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="backup"
              checked={backupConfirmed}
              onCheckedChange={(checked) => setBackupConfirmed(checked as boolean)}
            />
            <label
              htmlFor="backup"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I have securely backed up my private key(s) or I accept that these funds will be lost
            </label>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmation" className="text-sm font-medium">
              Type "I understand" to confirm:
            </label>
            <Input
              id="confirmation"
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              placeholder="I understand"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onProceed}
              disabled={!backupConfirmed || !hasTypedCorrectly}
              className="flex-1"
            >
              Archive Old Wallet(s) and Create New
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}