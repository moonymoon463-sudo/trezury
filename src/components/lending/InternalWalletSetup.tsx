import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";  
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wallet, Shield, Eye, EyeOff, Lock } from "lucide-react";
import { useAaveStyleLending } from "@/hooks/useAaveStyleLending";
import { useToast } from "@/hooks/use-toast";

export function InternalWalletSetup() {
  const { walletAddress, createWallet, loading } = useAaveStyleLending();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 12) {
      toast({
        variant: "destructive",
        title: "Password Too Short",
        description: "Password must be at least 12 characters long"
      });
      return;
    }
    
    try {
      setCreating(true);
      const walletInfo = await createWallet(password);
      
      if (walletInfo) {
        toast({
          title: "Internal Wallet Created",
          description: "Your secure internal wallet is ready to use"
        });
        setPassword('');
      }
    } catch (error) {
      console.error('Wallet creation failed:', error);
    } finally {
      setCreating(false);
    }
  };

  if (walletAddress) {
    return (
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Internal Wallet Active</p>
                <p className="text-sm text-muted-foreground">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <Shield className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Setup Internal Wallet
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Create a secure internal wallet to start using the lending platform. Your private keys are never stored and are derived from your password.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateWallet} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Wallet Password (12+ characters)</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter a strong password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                required
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
            <p className="text-xs text-muted-foreground">
              This password is used to generate your wallet deterministically. Keep it secure and don't forget it.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex gap-2">
              <Shield className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Security Features:</p>
                <ul className="text-xs mt-1 space-y-1">
                  <li>• Private keys are never stored on our servers</li>
                  <li>• Wallet is derived deterministically from your password</li>
                  <li>• Only you have access to your funds</li>
                  <li>• Works on Sepolia testnet for safe testing</li>
                </ul>
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={password.length < 12 || creating}
          >
            {creating ? "Creating Wallet..." : "Create Internal Wallet"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}