import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PasswordUnlockDialog } from './PasswordUnlockDialog';
import { useTradingPasswordContext } from '@/contexts/TradingPasswordContext';
import { useDydxTrading } from '@/hooks/useDydxTrading';
import { useToast } from '@/hooks/use-toast';
import { Shield, Lock } from 'lucide-react';
import type { DydxOrderSide, DydxOrderType } from '@/types/dydx-trading';

interface OrderFormProps {
  address?: string;
  selectedMarket?: string;
  currentPrice?: number;
  availableBalance: number;
  onOrderPlaced?: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  address,
  selectedMarket,
  currentPrice = 0,
  availableBalance,
  onOrderPlaced
}) => {
  const [side, setSide] = useState<DydxOrderSide>('BUY');
  const [orderType, setOrderType] = useState<DydxOrderType>('MARKET');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const { isUnlocked, getPassword, unlock } = useTradingPasswordContext();
  const { placeOrder, orderLoading } = useDydxTrading(address);
  const { toast } = useToast();

  const handleSizePercentage = (percentage: number) => {
    if (!currentPrice || !availableBalance) return;
    const maxSize = (availableBalance * leverage) / currentPrice;
    const newSize = (maxSize * percentage) / 100;
    setSize(newSize.toFixed(4));
  };

  const handlePlaceOrder = async () => {
    if (!selectedMarket || !size || parseFloat(size) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Order',
        description: 'Please enter a valid order size'
      });
      return;
    }

    const password = getPassword();
    if (!password) {
      setShowPasswordDialog(true);
      return;
    }

    try {
      const orderPrice = orderType === 'MARKET' ? undefined : parseFloat(price);
      
      await placeOrder({
        market: selectedMarket,
        side,
        type: orderType,
        size: parseFloat(size),
        price: orderPrice,
        leverage,
        password
      });

      // Reset form
      setSize('');
      setPrice('');
      
      onOrderPlaced?.();
      
      toast({
        title: 'Order Placed',
        description: `${side} order for ${size} ${selectedMarket.split('-')[0]} placed successfully`
      });
    } catch (error) {
      console.error('Order placement error:', error);
    }
  };

  const total = parseFloat(size || '0') * (orderType === 'MARKET' ? currentPrice : parseFloat(price || '0'));

  return (
    <div className="space-y-4">
      {/* Session Status */}
      {!isUnlocked && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2">
          <Lock className="h-4 w-4 text-yellow-500" />
          <p className="text-yellow-500 text-xs">
            Trading session locked. Unlock to place orders.
          </p>
        </div>
      )}

      {/* Side Toggle */}
      <div className="flex gap-1 bg-[#211d12] rounded-lg p-1">
        <button
          onClick={() => setSide('BUY')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
            side === 'BUY' 
              ? 'bg-green-600 text-white' 
              : 'text-[#c6b795] hover:text-white'
          }`}
        >
          Buy / Long
        </button>
        <button
          onClick={() => setSide('SELL')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
            side === 'SELL' 
              ? 'bg-red-600 text-white' 
              : 'text-[#c6b795] hover:text-white'
          }`}
        >
          Sell / Short
        </button>
      </div>

      {/* Order Type */}
      <div>
        <label className="text-[#c6b795] text-sm font-medium mb-2 block">Order Type</label>
        <Select value={orderType} onValueChange={(v) => setOrderType(v as DydxOrderType)}>
          <SelectTrigger className="bg-[#211d12] border-[#463c25] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#211d12] border-[#463c25]">
            <SelectItem value="MARKET" className="text-white">Market Order</SelectItem>
            <SelectItem value="LIMIT" className="text-white">Limit Order</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Price (for limit orders) */}
      {orderType === 'LIMIT' && (
        <div>
          <label className="text-[#c6b795] text-sm font-medium mb-2 block">Price (USD)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={currentPrice.toFixed(2)}
            className="w-full px-4 py-3 bg-[#211d12] border border-[#463c25] rounded-lg text-white focus:border-[#e6b951] focus:ring-1 focus:ring-[#e6b951]"
          />
        </div>
      )}

      {/* Size */}
      <div>
        <label className="text-[#c6b795] text-sm font-medium mb-2 block">
          Size ({selectedMarket?.split('-')[0] || 'BTC'})
        </label>
        <input
          type="number"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="0.00"
          className="w-full px-4 py-3 bg-[#211d12] border border-[#463c25] rounded-lg text-white focus:border-[#e6b951] focus:ring-1 focus:ring-[#e6b951]"
        />
        {/* Percentage Buttons */}
        <div className="flex gap-2 mt-2">
          {[0, 25, 50, 75, 100].map((pct) => (
            <Button
              key={pct}
              size="sm"
              variant="ghost"
              onClick={() => handleSizePercentage(pct)}
              className="flex-1 text-xs bg-[#211d12] text-[#c6b795] hover:bg-[#463c25] hover:text-white"
            >
              {pct}%
            </Button>
          ))}
        </div>
      </div>

      {/* Leverage */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[#c6b795] text-sm font-medium">Leverage</label>
          <Badge className="bg-[#e6b951]/20 text-[#e6b951]">{leverage}x</Badge>
        </div>
        <div className="flex gap-2 mb-2">
          {[1, 5, 10, 15, 20].map((lvg) => (
            <Button
              key={lvg}
              size="sm"
              variant={leverage === lvg ? "default" : "ghost"}
              onClick={() => setLeverage(lvg)}
              className={leverage === lvg 
                ? 'flex-1 text-xs bg-[#e6b951] text-black hover:bg-[#d4a840]' 
                : 'flex-1 text-xs bg-[#211d12] text-[#c6b795] hover:bg-[#463c25] hover:text-white'
              }
            >
              {lvg}x
            </Button>
          ))}
        </div>
        <input
          type="range"
          min="1"
          max="20"
          step="1"
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="w-full accent-[#e6b951]"
        />
      </div>

      {/* Order Summary */}
      <div className="space-y-2 pt-4 border-t border-[#463c25]">
        <div className="flex justify-between text-sm">
          <span className="text-[#c6b795]">Total:</span>
          <span className="text-white font-semibold">
            ${total.toFixed(2)} USD
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#c6b795]">Available:</span>
          <span className="text-white font-semibold">
            ${availableBalance.toFixed(2)} USD
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#c6b795]">Max Position:</span>
          <span className="text-white font-semibold">
            {currentPrice > 0 ? ((availableBalance * leverage) / currentPrice).toFixed(4) : '0.0000'} {selectedMarket?.split('-')[0] || 'BTC'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      {!isUnlocked ? (
        <Button
          onClick={() => setShowPasswordDialog(true)}
          className="w-full h-12 font-bold bg-[#e6b951] hover:bg-[#d4a840] text-black text-lg"
        >
          <Shield className="h-5 w-5 mr-2" />
          Unlock Trading
        </Button>
      ) : (
        <Button
          onClick={handlePlaceOrder}
          disabled={orderLoading || !selectedMarket || !size}
          className={`w-full h-12 font-bold text-lg ${
            side === 'BUY' 
              ? 'bg-green-600 hover:bg-green-700 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {orderLoading ? 'Placing Order...' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${selectedMarket?.split('-')[0] || 'BTC'}`}
        </Button>
      )}

      {/* Password Unlock Dialog */}
      <PasswordUnlockDialog
        open={showPasswordDialog}
        onUnlock={(password) => {
          unlock(password);
          setShowPasswordDialog(false);
        }}
        onCancel={() => setShowPasswordDialog(false)}
      />
    </div>
  );
};
