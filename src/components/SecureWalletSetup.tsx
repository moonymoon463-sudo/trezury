import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Eye, EyeOff, Shield, AlertTriangle } from "lucide-react";
import { secureWalletService } from "@/services/secureWalletService";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface SecureWalletSetupProps {
  onWalletCreated?: (address: string) => void;
}

const SecureWalletSetup: React.FC<SecureWalletSetupProps> = ({ onWalletCreated }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Password Too Short",
        description: "Password must be at least 8 characters (use your account password)"
      });
      return;
    }

    try {
      setLoading(true);
      
      const walletInfo = await secureWalletService.generateDeterministicWallet(
        user.id,
        { userPassword: password }
      );

      setWalletAddress(walletInfo.address);
      onWalletCreated?.(walletInfo.address);

      toast({
        title: "Secure Wallet Created",
        description: "Your wallet has been created securely without storing any private keys"
      });

      // Clear password from memory
      setPassword('');
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
          Create Secure Wallet
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Create a secure wallet without storing private keys
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>IMPORTANT:</strong> Use your login password. If you forget your login password, 
            you'll lose access to both your account AND your wallet.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Account Password
          </label>
          <p className="text-xs text-muted-foreground">
            Enter the same password you use to log in
          </p>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your account password"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>✓ Uses your account password - nothing new to remember</div>
            <div>✓ One password for login and wallet</div>
            <div>✓ No private keys stored anywhere</div>
            <div>✓ You control your own security</div>
          </div>
        </div>

        <Button
          onClick={handleCreateWallet}
          disabled={loading || !password}
          className="w-full"
        >
          {loading ? "Creating Secure Wallet..." : "Create Wallet"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SecureWalletSetup;