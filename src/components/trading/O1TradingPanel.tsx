/**
 * 01 Protocol Trading Panel
 * Example component demonstrating the trading service integration
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { use01Trading } from '@/hooks/use01Trading';
import { Loader2 } from 'lucide-react';

export const O1TradingPanel = () => {
  const { placeOrder, closePosition, loading, error } = use01Trading();
  
  const [market, setMarket] = useState('SOL-PERP');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [size, setSize] = useState('1');
  const [price, setPrice] = useState('');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [password, setPassword] = useState('');

  const handlePlaceOrder = async () => {
    if (!password) {
      alert('Please enter your wallet password');
      return;
    }

    const result = await placeOrder(
      {
        market,
        side,
        size: parseFloat(size),
        price: price ? parseFloat(price) : undefined,
        orderType,
        leverage: 10,
      },
      password
    );

    if (result.ok) {
      setPassword(''); // Clear password after use
    }
  };

  const handleClosePosition = async () => {
    if (!password) {
      alert('Please enter your wallet password');
      return;
    }

    const result = await closePosition({ market }, password);

    if (result.ok) {
      setPassword('');
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>01 Protocol Trading</CardTitle>
        <CardDescription>
          Place orders on Solana perpetuals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Market Selection */}
        <div className="space-y-2">
          <Label htmlFor="market">Market</Label>
          <Select value={market} onValueChange={setMarket}>
            <SelectTrigger id="market">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SOL-PERP">SOL-PERP</SelectItem>
              <SelectItem value="BTC-PERP">BTC-PERP</SelectItem>
              <SelectItem value="ETH-PERP">ETH-PERP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Order Type */}
        <div className="space-y-2">
          <Label htmlFor="orderType">Order Type</Label>
          <Select value={orderType} onValueChange={(v) => setOrderType(v as 'market' | 'limit')}>
            <SelectTrigger id="orderType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="market">Market</SelectItem>
              <SelectItem value="limit">Limit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Side */}
        <div className="space-y-2">
          <Label htmlFor="side">Side</Label>
          <Select value={side} onValueChange={(v) => setSide(v as 'long' | 'short')}>
            <SelectTrigger id="side">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Size */}
        <div className="space-y-2">
          <Label htmlFor="size">Size</Label>
          <Input
            id="size"
            type="number"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="1.0"
            step="0.1"
          />
        </div>

        {/* Price (only for limit orders) */}
        {orderType === 'limit' && (
          <div className="space-y-2">
            <Label htmlFor="price">Limit Price</Label>
            <Input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              step="0.01"
            />
          </div>
        )}

        {/* Wallet Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Wallet Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
          <p className="text-xs text-muted-foreground">
            Required to decrypt your Solana wallet for signing
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handlePlaceOrder}
            disabled={loading || !password}
            className="flex-1"
            variant={side === 'long' ? 'default' : 'destructive'}
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

          <Button
            onClick={handleClosePosition}
            disabled={loading || !password}
            variant="outline"
          >
            Close
          </Button>
        </div>

        {/* Info */}
        <div className="p-3 bg-muted rounded-md text-xs space-y-1">
          <p className="font-semibold">🔐 Security Notes:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Orders execute via secure edge function</li>
            <li>Private key never leaves the server</li>
            <li>Password not stored, used only for decryption</li>
            <li>All trades logged for audit</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
