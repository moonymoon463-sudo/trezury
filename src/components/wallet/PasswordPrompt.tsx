import { useState } from "react";
import { Eye, EyeOff, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PasswordPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => void;
  loading?: boolean;
}

export function PasswordPrompt({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: PasswordPromptProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onConfirm(password);
      setPassword("");
      setShowPassword(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setShowPassword(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Lock className="h-5 w-5 text-primary" />
            Enter Wallet Password
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter your wallet password to continue. This password was used when you created your wallet.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-muted-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your wallet password"
                required
                disabled={loading}
                className="bg-input border-border text-white pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div className="p-3 bg-accent/50 rounded-lg border border-primary/20">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Shield className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
              <span>This password was set when you created your wallet. It's used to securely derive your private keys.</span>
            </p>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="bg-input border-border text-white hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!password.trim() || loading}
              className="bg-primary text-black hover:bg-primary/90"
            >
              {loading ? "Verifying..." : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
