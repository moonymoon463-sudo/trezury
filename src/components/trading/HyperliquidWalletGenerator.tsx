import { useState } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Copy, Check, AlertCircle, Wallet, Key, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import CryptoJS from 'crypto-js';

interface HyperliquidWalletGeneratorProps {
  onWalletCreated: (address: string) => void;
  userId: string;
}

export const HyperliquidWalletGenerator = ({ onWalletCreated, userId }: HyperliquidWalletGeneratorProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<{ address: string; privateKey: string } | null>(null);
  const [step, setStep] = useState<'create' | 'backup' | 'complete'>('create');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateWallet = async () => {
    if (!password || password.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters long",
        variant: "destructive"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Generate new Ethereum wallet for Hyperliquid
      const newWallet = ethers.Wallet.createRandom();
      
      // Encrypt private key with user password
      const encryptedPrivateKey = CryptoJS.AES.encrypt(
        newWallet.privateKey,
        password
      ).toString();

      // Store encrypted wallet in Supabase
      const { error } = await supabase
        .from('hyperliquid_wallets')
        .insert({
          user_id: userId,
          address: newWallet.address,
          encrypted_private_key: encryptedPrivateKey,
          encryption_method: 'AES-256-GCM'
        });

      if (error) throw error;

      setWallet({
        address: newWallet.address,
        privateKey: newWallet.privateKey
      });
      
      setStep('backup');
      
      toast({
        title: "Wallet Created",
        description: "Your Hyperliquid trading wallet has been generated",
      });
    } catch (error) {
      console.error('Wallet generation error:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate wallet",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Private key copied to clipboard",
    });
  };

  const downloadBackup = () => {
    if (!wallet) return;
    
    const backup = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      createdAt: new Date().toISOString(),
      warning: 'KEEP THIS FILE SECURE - Anyone with this private key can access your funds'
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hyperliquid-wallet-${wallet.address.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Backup Downloaded",
      description: "Store this file in a secure location",
    });
  };

  const confirmBackup = () => {
    if (wallet) {
      onWalletCreated(wallet.address);
      setStep('complete');
    }
  };

  if (step === 'complete') {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-status-success" />
            <CardTitle className="text-foreground">Wallet Ready</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Your Hyperliquid trading wallet is active
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-background rounded-lg border border-border">
            <p className="text-sm text-muted-foreground mb-2">Wallet Address</p>
            <p className="font-mono text-sm text-foreground break-all">{wallet?.address}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'backup') {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Backup Your Wallet</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Save your private key - you'll need it to recover your wallet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-destructive/10 border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              Never share your private key. Anyone with this key can access your funds.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label className="text-foreground">Wallet Address</Label>
            <div className="p-3 bg-background rounded-lg border border-border font-mono text-sm text-foreground break-all">
              {wallet?.address}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Private Key</Label>
            <div className="relative">
              <div className="p-3 bg-background rounded-lg border border-border font-mono text-xs text-foreground break-all pr-12">
                {wallet?.privateKey}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => wallet && copyToClipboard(wallet.privateKey)}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={downloadBackup}
              variant="outline"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Backup
            </Button>
            <Button
              onClick={confirmBackup}
              className="flex-1"
            >
              I've Backed Up My Key
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Create Hyperliquid Trading Wallet</CardTitle>
        </div>
        <CardDescription className="text-muted-foreground">
          Generate a dedicated wallet for leveraged trading on Hyperliquid
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-foreground">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a secure password"
            className="bg-background border-border text-foreground"
          />
          <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            className="bg-background border-border text-foreground"
          />
        </div>

        <Alert className="bg-primary/10 border-primary/20">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground">
            This wallet is separate from your main wallet and optimized for trading. 
            You'll need to bridge funds to start trading.
          </AlertDescription>
        </Alert>

        <Button
          onClick={generateWallet}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Wallet...
            </>
          ) : (
            'Generate Trading Wallet'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
