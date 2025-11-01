import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Shield, Loader2, Info } from 'lucide-react';
import { use01Trading } from '@/hooks/use01Trading';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface O1OrderEntryProps {
  market: string;
  currentPrice: number;
}

export const O1OrderEntry = ({ market, currentPrice }: O1OrderEntryProps) => {
  const { placeOrder, loading } = use01Trading();
  const { toast } = useToast();

  const [side, setSide] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [size, setSize] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [leverage, setLeverage] = useState([10]);
  const [password, setPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const handlePlaceOrder = () => {
    if (!size || parseFloat(size) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Size',
        description: 'Please enter a valid position size',
      });
      return;
    }

    if (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Price',
        description: 'Please enter a valid limit price',
      });
      return;
    }

    setShowPasswordDialog(true);
  };

  const handlePasswordSubmit = async () => {
    if (!password) {
      toast({
        variant: 'destructive',
        title: 'Password Required',
        description: 'Please enter your wallet password',
      });
      return;
    }

    setShowPasswordDialog(false);

    const result = await placeOrder(
      {
        market,
        side,
        size: parseFloat(size),
        price: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
        orderType,
        leverage: leverage[0],
      },
      password
    );

    if (result.ok) {
      // Clear form
      setSize('');
      setLimitPrice('');
      setPassword('');
    }
  };

  const estimatedValue = parseFloat(size || '0') * (orderType === 'limit' ? parseFloat(limitPrice || '0') : currentPrice);
  const marginRequired = estimatedValue / leverage[0];

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {/* Side Toggle */}
          <Tabs value={side} onValueChange={(v) => setSide(v as 'long' | 'short')}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="long" className="data-[state=active]:bg-status-success data-[state=active]:text-white">
                Long
              </TabsTrigger>
              <TabsTrigger value="short" className="data-[state=active]:bg-status-error data-[state=active]:text-white">
                Short
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Order Type */}
          <div className="space-y-2">
            <Label>Order Type</Label>
            <Tabs value={orderType} onValueChange={(v) => setOrderType(v as 'market' | 'limit')}>
              <TabsList className="w-full grid grid-cols-2 bg-muted">
                <TabsTrigger value="market">Market</TabsTrigger>
                <TabsTrigger value="limit">Limit</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Leverage Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Leverage</Label>
              <span className="text-sm font-semibold text-primary">{leverage[0]}x</span>
            </div>
            <Slider
              value={leverage}
              onValueChange={setLeverage}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1x</span>
              <span>10x</span>
              <span>20x</span>
            </div>
          </div>

          <Separator />

          {/* Limit Price (only for limit orders) */}
          {orderType === 'limit' && (
            <div className="space-y-2">
              <Label htmlFor="limitPrice">Limit Price</Label>
              <Input
                id="limitPrice"
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
              />
            </div>
          )}

          {/* Size */}
          <div className="space-y-2">
            <Label htmlFor="size">Size</Label>
            <Input
              id="size"
              type="number"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="0.0"
              step="0.1"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Available: $0.00</span>
              <button className="text-primary hover:underline">Max</button>
            </div>
          </div>

          {/* Order Summary */}
          <Card className="bg-muted/50 border-border/40 p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estimated Value</span>
              <span className="text-foreground font-medium">
                ${estimatedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Margin Required</span>
              <span className="text-foreground font-medium">
                ${marginRequired.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. Fees</span>
              <span className="text-foreground font-medium">~$0.50</span>
            </div>
          </Card>

          {/* Place Order Button */}
          <Button
            onClick={handlePlaceOrder}
            disabled={loading || !size}
            className={`w-full h-12 text-base font-semibold ${
              side === 'long'
                ? 'bg-status-success hover:bg-status-success/90'
                : 'bg-status-error hover:bg-status-error/90'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `${side === 'long' ? 'Buy' : 'Sell'} ${market}`
            )}
          </Button>

          {/* Security Notice */}
          <Card className="bg-card/50 border-border/40 p-3">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Secure Trading</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>• Orders execute via secure server</li>
                  <li>• Private key never exposed</li>
                  <li>• All trades logged for audit</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </ScrollArea>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Order</DialogTitle>
            <DialogDescription>
              Enter your wallet password to sign and execute this order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Wallet Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordSubmit();
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordSubmit} disabled={!password}>
              Confirm Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
