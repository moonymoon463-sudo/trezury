import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';

export function SecureWalletImport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [privateKey, setPrivateKey] = useState('');
  const [password, setPassword] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedAddress, setImportedAddress] = useState<string | null>(null);

  const handleImport = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to import a wallet',
        variant: 'destructive'
      });
      return;
    }

    if (!privateKey || !password) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both private key and password',
        variant: 'destructive'
      });
      return;
    }

    setImporting(true);

    try {
      // 1. Validate private key format
      let cleanedKey = privateKey.trim();
      if (!cleanedKey.startsWith('0x')) {
        cleanedKey = '0x' + cleanedKey;
      }

      // 2. Derive address locally
      const wallet = new ethers.Wallet(cleanedKey);
      const address = wallet.address;

      // 3. Check if address already exists for user
      const { data: existingWallet } = await supabase
        .from('onchain_addresses')
        .select('address, status')
        .eq('user_id', user.id)
        .eq('address', address)
        .maybeSingle();

      if (existingWallet) {
        toast({
          title: 'Wallet Already Exists',
          description: `This wallet (${address}) is already registered`,
          variant: 'default'
        });
        setImportedAddress(address);
        setImporting(false);
        return;
      }

      // 4. Check for balance on-chain (non-blocking)
      let balance = 0;
      try {
        const { data: balanceData } = await supabase.functions.invoke('blockchain-operations', {
          body: {
            operation: 'get_balance',
            address,
            asset: 'USDC'
          }
        });
        balance = balanceData?.balance || 0;
      } catch (e) {
        console.warn('Could not check balance:', e);
      }

      // 5. Encrypt with user password
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
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
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        new TextEncoder().encode(cleanedKey)
      );

      // 6. Store in encrypted_wallet_keys
      const { error: keyError } = await supabase
        .from('encrypted_wallet_keys')
        .insert({
          user_id: user.id,
          encrypted_private_key: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
          encryption_iv: btoa(String.fromCharCode(...iv)),
          encryption_salt: btoa(String.fromCharCode(...salt)),
          encryption_method: 'password_based'
        });

      if (keyError) throw keyError;

      // 7. Add to onchain_addresses (no overwrite)
      const { error: addressError } = await supabase
        .from('onchain_addresses')
        .insert({
          user_id: user.id,
          address,
          chain: 'ethereum',
          asset: 'XAUT',
          setup_method: 'imported',
          status: 'active',
          is_primary: false,
          balance_snapshot: balance
        });

      if (addressError) throw addressError;

      // 8. Create audit log
      await supabase.from('wallet_change_audit').insert({
        user_id: user.id,
        new_address: address,
        change_type: 'imported',
        had_balance: balance > 0,
        balance_at_change: balance,
        user_confirmed: true
      });

      setImportedAddress(address);
      toast({
        title: 'Wallet Imported Successfully',
        description: `Wallet ${address.substring(0, 10)}... has been imported`,
      });

      // Clear sensitive data
      setPrivateKey('');
      setPassword('');
    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import wallet',
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Existing Wallet
        </CardTitle>
        <CardDescription>
          Import a wallet using your private key. The key will be encrypted with your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!importedAddress ? (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Security Warning:</strong> Never share your private key with anyone. 
                Make sure you trust this application and are on the correct website.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="privateKey">Private Key</Label>
              <div className="relative">
                <Input
                  id="privateKey"
                  type={showPrivateKey ? 'text' : 'password'}
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="0x..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                >
                  {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Encryption Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your account password"
              />
              <p className="text-xs text-muted-foreground">
                Use your account password to encrypt the private key
              </p>
            </div>

            <Button
              onClick={handleImport}
              disabled={importing || !privateKey || !password}
              className="w-full"
            >
              {importing ? 'Importing...' : 'Import Wallet'}
            </Button>
          </>
        ) : (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Success!</strong> Wallet imported: {importedAddress}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}