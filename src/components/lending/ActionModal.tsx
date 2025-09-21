import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLendingOperations, PoolAsset } from "@/hooks/useLendingOperations";

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: 'supply' | 'borrow' | null;
  asset: PoolAsset | null;
}

export function ActionModal({ isOpen, onClose, action, asset }: ActionModalProps) {
  const [amount, setAmount] = useState("");
  const { supply, borrow, loading } = useLendingOperations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset || !action || !amount) return;

    try {
      const numAmount = parseFloat(amount);
      if (action === 'supply') {
        await supply(asset.asset, asset.chain, numAmount);
      } else {
        await borrow(asset.asset, asset.chain, numAmount);
      }
      
      setAmount("");
      onClose();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const formatApy = (apy: number) => `${(apy * 100).toFixed(2)}%`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {action === 'supply' ? 'Supply' : 'Borrow'} {asset?.asset}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter the amount you want to {action === 'supply' ? 'supply' : 'borrow'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-foreground">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.000001"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-background border-border text-foreground"
              required
            />
          </div>

          {asset && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">APY</div>
                <div className="font-medium text-foreground">
                  {formatApy(action === 'supply' ? asset.supplyApy : asset.borrowApy)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Available</div>
                <div className="font-medium text-foreground">
                  {asset.available.toLocaleString()} {asset.asset}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || !amount}
            >
              {loading ? 'Processing...' : action === 'supply' ? 'Supply' : 'Borrow'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}