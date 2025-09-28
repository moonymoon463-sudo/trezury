import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, CreditCard, Shield, Calendar, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMoonPayRecurring } from "@/hooks/useMoonPayRecurring";

interface AutoInvestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userCountry?: string;
}

const SUPPORTED_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', popular: true },
  { symbol: 'ETH', name: 'Ethereum', popular: true },
  { symbol: 'USDC', name: 'USD Coin', popular: true },
  { symbol: 'XAUT', name: 'Tether Gold', popular: true },
  { symbol: 'ADA', name: 'Cardano', popular: false },
  { symbol: 'SOL', name: 'Solana', popular: false },
  { symbol: 'MATIC', name: 'Polygon', popular: false },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Daily', description: 'Every day' },
  { value: 'weekly', label: 'Weekly', description: 'Every week' },
  { value: 'monthly', label: 'Monthly', description: 'Every month' },
];

export const AutoInvestModal = ({ 
  open, 
  onOpenChange,
  userCountry = 'GB'
}: AutoInvestModalProps) => {
  const [amount, setAmount] = useState('50');
  const [currency] = useState('GBP');
  const [selectedAsset, setSelectedAsset] = useState('XAUT');
  const [frequency, setFrequency] = useState('weekly');
  
  const { initiateRecurringBuy, loading } = useMoonPayRecurring();

  const handleSetupRecurring = async () => {
    if (!amount || !selectedAsset || !frequency) return;

    const result = await initiateRecurringBuy({
      amount: parseFloat(amount),
      currency,
      assetSymbol: selectedAsset,
      frequency: frequency as 'daily' | 'weekly' | 'monthly'
    });

    if (result.success && result.redirectUrl) {
      // Open MoonPay in new window/iframe
      window.open(result.redirectUrl, '_blank', 'width=500,height=700,scrollbars=yes,resizable=yes');
      onOpenChange(false);
    }
  };

  const popularAssets = SUPPORTED_ASSETS.filter(asset => asset.popular);
  const allAssets = SUPPORTED_ASSETS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Set up Auto-Invest
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Region & Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Your Region: {userCountry}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CreditCard className="h-3 w-3" />
                <span>Bank transfers, debit cards supported</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                <span>Regulated by MoonPay (FCA authorized)</span>
              </div>
            </CardContent>
          </Card>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount per purchase</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50"
                min="10"
                max="10000"
                className="pr-12"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-sm text-muted-foreground">{currency}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Minimum: £10 • Maximum: £10,000</p>
          </div>

          {/* Asset Selection */}
          <div className="space-y-3">
            <Label>Choose asset to buy</Label>
            
            {/* Popular Assets */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Popular</p>
              <div className="grid grid-cols-2 gap-2">
                {popularAssets.map((asset) => (
                  <Button
                    key={asset.symbol}
                    variant={selectedAsset === asset.symbol ? "default" : "outline"}
                    className="h-12 flex flex-col items-center justify-center p-2"
                    onClick={() => setSelectedAsset(asset.symbol)}
                  >
                    <span className="font-medium text-xs">{asset.symbol}</span>
                    <span className="text-xs opacity-70 truncate">{asset.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* All Assets Dropdown */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Or choose from all assets</p>
              <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                <SelectTrigger>
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
                <SelectContent>
                  {allAssets.map((asset) => (
                    <SelectItem key={asset.symbol} value={asset.symbol}>
                      <div className="flex items-center justify-between w-full">
                        <span>{asset.symbol}</span>
                        <span className="text-xs text-muted-foreground ml-2">{asset.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Frequency Selection */}
          <div className="space-y-2">
            <Label>How often? (for reference only)</Label>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCIES.map((freq) => (
                <Button
                  key={freq.value}
                  variant={frequency === freq.value ? "default" : "outline"}
                  className="h-12 flex flex-col items-center justify-center p-2"
                  onClick={() => setFrequency(freq.value)}
                >
                  <span className="font-medium text-xs">{freq.label}</span>
                  <span className="text-xs opacity-70">{freq.description}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Important Notice */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Note:</strong> Recurring schedules are set up and managed within MoonPay. 
              The final schedule will be configured in MoonPay's interface after you proceed.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetupRecurring}
              disabled={loading || !amount || parseFloat(amount) < 10}
              className="flex-1"
            >
              {loading ? 'Setting up...' : 'Continue to MoonPay'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            You'll be taken to MoonPay to complete the setup and verify your identity.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};