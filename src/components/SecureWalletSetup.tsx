import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Shield } from "lucide-react";
import { secureWalletService } from "@/services/secureWalletService";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface SecureWalletSetupProps {
  onWalletCreated?: (address: string) => void;
}

const SecureWalletSetup: React.FC<SecureWalletSetupProps> = ({ onWalletCreated }) => {
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleCreateWallet = async () => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to create a wallet"
      });
      return;
    }

    try {
      setLoading(true);
      
      // Instant wallet creation - NO PASSWORD REQUIRED
      const walletInfo = await secureWalletService.generateRandomWallet(user.id);

      setWalletAddress(walletInfo.address);
      onWalletCreated?.(walletInfo.address);

      toast({
        title: "Wallet Created Instantly",
        description: "Your secure wallet is ready to use!"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Wallet Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create wallet"
      });
    } finally {
      setLoading(false);
    }
  };

  if (walletAddress) {
    return (
      <Card className="w-full max-w-md mx-auto bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Shield className="h-5 w-5 text-green-500" />
            Wallet Created Securely
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Your Wallet Address:</div>
            <div className="font-mono text-sm text-foreground break-all">
              {walletAddress}
            </div>
          </div>
          
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Your private keys are never stored anywhere. You'll need your account password for transactions.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Lock className="h-5 w-5" />
          Create Your Wallet
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Instant wallet creation - no password required
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Your wallet will be created instantly. You'll only need your 
            account password to reveal your private key for backup purposes.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>✓ Instant wallet creation</div>
            <div>✓ Private key encrypted with your account password</div>
            <div>✓ Password only needed for backup/reveal</div>
            <div>✓ Secure encryption using AES-256-GCM</div>
          </div>
        </div>

        <Button
          onClick={handleCreateWallet}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Creating Wallet..." : "Create Wallet Instantly"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SecureWalletSetup;