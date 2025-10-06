import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ethers } from "ethers";
import { useToast } from "@/hooks/use-toast";

interface ImportWalletKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportWalletKeyModal({ open, onOpenChange, onSuccess }: ImportWalletKeyModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [privateKey, setPrivateKey] = useState('');
  const [password, setPassword] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const KDF_ITERATIONS = 100000;

  const encryptPrivateKey = async (
    privateKey: string,
    password: string
  ): Promise<{ encryptedKey: string; iv: string; salt: string }> => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive encryption key from password
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: KDF_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Encrypt private key
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      new TextEncoder().encode(privateKey)
    );
    
    return {
      encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv)),
      salt: btoa(String.fromCharCode(...salt))
    };
  };

  const handleImport = async () => {
    if (!user) {
      setError('You must be logged in');
      return;
    }

    if (!privateKey || !password) {
      setError('Private key and password are required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setImporting(true);
    setError('');

    try {
      // Validate private key format
      let normalizedKey = privateKey.trim();
      if (!normalizedKey.startsWith('0x')) {
        normalizedKey = '0x' + normalizedKey;
      }

      // Create wallet to validate and get address
      const wallet = new ethers.Wallet(normalizedKey);
      console.log(`✅ Valid private key for address: ${wallet.address}`);

      // Encrypt private key
      const { encryptedKey, iv, salt } = await encryptPrivateKey(normalizedKey, password);

      // Update encrypted_wallet_keys
      const { error: keyError } = await supabase
        .from('encrypted_wallet_keys')
        .upsert({
          user_id: user.id,
          encrypted_private_key: encryptedKey,
          encryption_iv: iv,
          encryption_salt: salt,
          encryption_method: 'password_based'
        }, {
          onConflict: 'user_id'
        });

      if (keyError) {
        throw new Error(`Failed to store encrypted key: ${keyError.message}`);
      }

      // Update onchain_addresses to the new address
      const { error: addressError } = await supabase
        .from('onchain_addresses')
        .upsert({
          user_id: user.id,
          address: wallet.address,
          chain: 'ethereum',
          asset: 'USDC',
          setup_method: 'imported_key',
          created_with_password: true
        }, {
          onConflict: 'user_id'
        });

      if (addressError) {
        throw new Error(`Failed to update address: ${addressError.message}`);
      }

      // Log security event
      await supabase.from('security_alerts').insert({
        alert_type: 'wallet_key_imported',
        severity: 'medium',
        title: 'Wallet Key Imported',
        description: `User imported a new wallet key for address ${wallet.address}`,
        user_id: user.id,
        metadata: { address: wallet.address }
      });

      toast({
        title: "Wallet Key Imported",
        description: `Successfully imported wallet for ${wallet.address.substring(0, 10)}...`,
      });

      // Clear sensitive data
      setPrivateKey('');
      setPassword('');
      
      onSuccess();
    } catch (err) {
      console.error('Import failed:', err);
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Import Wallet Private Key
          </DialogTitle>
          <DialogDescription>
            Import your wallet's private key to enable swaps. The key will be encrypted with your password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Never share your private key with anyone. This will replace your current wallet.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="privateKey">Private Key</Label>
            <Input
              id="privateKey"
              type="password"
              placeholder="0x..."
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              disabled={importing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Encryption Password (min 8 chars)</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={importing}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={importing || !privateKey || !password}
              className="flex-1"
            >
              {importing ? 'Importing...' : 'Import Key'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={importing}
            >
              Cancel
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Your private key will be encrypted using AES-256-GCM with PBKDF2 (100k iterations) and stored securely in the database.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
