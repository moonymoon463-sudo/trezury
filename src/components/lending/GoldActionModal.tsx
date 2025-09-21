import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLendingOperations, PoolAsset } from "@/hooks/useLendingOperations";
import { ArrowUpDown, Loader2 } from "lucide-react";

interface GoldActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: 'supply' | 'borrow' | null;
  asset: PoolAsset | null;
}

export function GoldActionModal({ isOpen, onClose, action, asset }: GoldActionModalProps) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "TOKENS">("USD");
  const { supply, borrow, loading } = useLendingOperations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0 || !asset) {
      return;
    }

    try {
      if (action === 'supply') {
        await supply(asset.asset, asset.chain, numericAmount);
      } else if (action === 'borrow') {
        await borrow(asset.asset, asset.chain, numericAmount);
      }
      onClose();
      setAmount("");
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  const handleAmountChange = (value: string) => {
    const cleanValue = value.replace(/[^0-9.]/g, '');
    setAmount(cleanValue);
  };

  const formatApy = (apy: number) => `${(apy * 100).toFixed(2)}%`;

  if (!asset) return null;

  const currentApy = action === 'supply' ? asset.supplyApy : asset.borrowApy;
  const currentColor = action === 'supply' ? 'text-green-400' : 'text-red-400';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1C1C1E] border-gray-700 max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-center">
            {action === 'supply' ? 'Supply' : 'Borrow'} {asset.asset}
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-center">
            {action === 'supply' 
              ? `Earn ${formatApy(currentApy)} APY by supplying ${asset.asset}`
              : `Borrow ${asset.asset} at ${formatApy(currentApy)} APY`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Currency Toggle */}
          <div className="flex justify-center">
            <div className="inline-flex rounded-full bg-[#2C2C2E] p-1">
              <button 
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  currency === "USD" 
                    ? "bg-[#f9b006] text-black" 
                    : "text-gray-400"
                }`}
                onClick={() => setCurrency("USD")}
              >
                USD
              </button>
              <button 
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  currency === "TOKENS" 
                    ? "bg-[#f9b006] text-black" 
                    : "text-gray-400"
                }`}
                onClick={() => setCurrency("TOKENS")}
              >
                {asset.asset}
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-white">
              Amount {currency === "USD" ? "(USD)" : `(${asset.asset})`}
            </Label>
            <div className="relative">
              {currency === "USD" && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  $
                </span>
              )}
              <input
                id="amount"
                type="text"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className={`w-full bg-[#2C2C2E] border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-[#f9b006] focus:outline-none ${
                  currency === "USD" ? "pl-8" : ""
                }`}
                placeholder={currency === "USD" ? "0.00" : "0"}
              />
            </div>
          </div>

          {/* Asset Info */}
          <div className="bg-[#2C2C2E] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">APY</span>
              <span className={`font-semibold ${currentColor}`}>
                {formatApy(currentApy)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Available</span>
              <span className="text-white">
                {asset.available.toLocaleString()} {asset.asset}
              </span>
            </div>
            {asset.asset === 'XAUT' && (
              <div className="border-t border-gray-600 pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-[#f9b006]">🥇</span>
                  <span className="text-[#f9b006] text-sm">
                    Backed by physical gold
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-600 bg-transparent text-white rounded-xl hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={!amount || parseFloat(amount) <= 0 || loading}
              className="flex-1 bg-[#f9b006] text-black font-bold rounded-xl hover:bg-[#f9b006]/90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                action === 'supply' ? 'Supply' : 'Borrow'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}