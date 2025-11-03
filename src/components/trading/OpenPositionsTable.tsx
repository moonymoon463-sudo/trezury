import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useHyperliquidPositions } from '@/hooks/useHyperliquidPositions';
import type { HyperliquidPositionDB } from '@/types/hyperliquid';
import { hyperliquidTradingService } from '@/services/hyperliquidTradingService';
import { TrendingUp, TrendingDown, AlertTriangle, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTradingPasswordContext } from '@/contexts/TradingPasswordContext';

interface OpenPositionsTableProps {
  address?: string;
  currentPrices: Record<string, number>;
}

type SortField = 'market' | 'size' | 'pnl' | 'leverage' | 'liquidation';
type SortDirection = 'asc' | 'desc';

export const OpenPositionsTable = ({ address, currentPrices }: OpenPositionsTableProps) => {
  // Mock data for now
  const mockPositions: DydxPosition[] = [
    {
      market: 'BTC-USD',
      side: 'LONG',
      size: 0.5,
      entryPrice: 95000,
      unrealizedPnl: 2500,
      realizedPnl: 0
    },
    {
      market: 'ETH-USD',
      side: 'SHORT',
      size: 2.5,
      entryPrice: 3500,
      unrealizedPnl: -450,
      realizedPnl: 0
    },
    {
      market: 'SOL-USD',
      side: 'LONG',
      size: 50,
      entryPrice: 180,
      unrealizedPnl: 1200,
      realizedPnl: 0
    }
  ];

  const positions = mockPositions;
  const loading = false;
  const error = null;

  const { toast } = useToast();
  const { getPassword } = useTradingPasswordContext();
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<DydxPosition | null>(null);
  const [closeOrderType, setCloseOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [closeLimitPrice, setCloseLimitPrice] = useState('');


  const openCloseDialog = (position: DydxPosition) => {
    setSelectedPosition(position);
    setCloseOrderType('MARKET');
    setCloseLimitPrice('');
    setCloseDialogOpen(true);
  };

  const handleClosePosition = async () => {
    if (!selectedPosition) return;

    const password = getPassword();
    if (!password) {
      toast({
        variant: 'destructive',
        title: 'Session Locked',
        description: 'Please unlock your trading session first',
      });
      return;
    }

    if (closeOrderType === 'LIMIT' && !closeLimitPrice) {
      toast({
        variant: 'destructive',
        title: 'Price Required',
        description: 'Please enter a limit price',
      });
      return;
    }

    setClosingPosition(selectedPosition.market);
    setCloseDialogOpen(false);
    
    try {
      const response = await dydxTradingService.closePosition(
        selectedPosition.market, 
        password,
        undefined,
        closeOrderType,
        closeOrderType === 'LIMIT' ? parseFloat(closeLimitPrice) : undefined
      );
      
      if (response.success) {
        toast({
          title: 'Position Closed',
          description: `Successfully closed ${selectedPosition.market} position with ${closeOrderType} order`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Close',
          description: response.error || 'Unknown error occurred',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to close position',
      });
    } finally {
      setClosingPosition(null);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertTriangle className="h-4 w-4 mr-2" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-muted-foreground text-sm">No open positions</div>
        <div className="text-muted-foreground/60 text-xs mt-1">Open a position to start trading</div>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="space-y-2 p-3">
          {positions.map((position, index) => {
            const currentPrice = currentPrices[position.market] || position.entryPrice;
            const pnl = position.side === 'LONG'
              ? (currentPrice - position.entryPrice) * position.size
              : (position.entryPrice - currentPrice) * position.size;
            const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100 * (position.side === 'LONG' ? 1 : -1);
            const isProfit = pnl > 0;
            
            const leverage = 10;
            const marginRequired = (currentPrice * position.size) / leverage;
            const maintenanceMargin = 0.03;
            const liquidationPrice = position.side === 'LONG'
              ? position.entryPrice * (1 - (1 / leverage) + maintenanceMargin)
              : position.entryPrice * (1 + (1 / leverage) - maintenanceMargin);
            
            const distanceToLiquidation = Math.abs(((currentPrice - liquidationPrice) / currentPrice) * 100);
            const riskLevel = 
              distanceToLiquidation < 5 ? 'critical' :
              distanceToLiquidation < 15 ? 'high' :
              distanceToLiquidation < 30 ? 'medium' : 'low';

            return (
              <Card key={`${position.market}-${index}`} className="bg-card/50 border-border/40 hover:bg-card/60 transition-colors">
                <div className="p-3">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-semibold text-sm">{position.market}</span>
                      <Badge
                        variant={position.side === 'LONG' ? 'default' : 'destructive'}
                        className="text-[10px] h-5 px-2"
                      >
                        {position.side}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-5 px-2">
                        {leverage}x
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openCloseDialog(position)}
                      disabled={closingPosition === position.market}
                      className="h-7 px-2 text-xs"
                    >
                      {closingPosition === position.market ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Close'
                      )}
                    </Button>
                  </div>

                  {/* Main Stats Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Size</div>
                      <div className="text-xs font-medium text-foreground">
                        {position.size.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Entry</div>
                      <div className="text-xs font-medium text-foreground">
                        ${position.entryPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Mark</div>
                      <div className="text-xs font-medium text-foreground">
                        ${currentPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>

                  <Separator className="my-2" />

                  {/* P&L and Risk */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Unrealized P&L</div>
                      <div className={`flex items-center gap-1 font-semibold text-sm ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                        {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>{isProfit ? '+' : ''}${pnl.toFixed(2)}</span>
                        <span className="text-[10px] opacity-60">
                          ({isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Margin Used</div>
                      <div className="text-xs font-medium text-foreground">
                        ${marginRequired.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>

                  <Separator className="my-2" />

                  {/* Liquidation */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-[10px] text-muted-foreground mb-0.5">Liq. Price</div>
                      <div className="text-xs font-medium text-foreground">
                        ${liquidationPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${
                          riskLevel === 'critical' ? 'bg-red-500 animate-pulse' :
                          riskLevel === 'high' ? 'bg-orange-500' :
                          riskLevel === 'medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                      />
                      <span className={`text-[10px] font-medium ${
                        riskLevel === 'critical' ? 'text-red-500' :
                        riskLevel === 'high' ? 'text-orange-500' :
                        riskLevel === 'medium' ? 'text-yellow-500' :
                        'text-green-500'
                      }`}>
                        {distanceToLiquidation.toFixed(1)}% away
                      </span>
                      {riskLevel === 'critical' && (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close Position</DialogTitle>
            <DialogDescription>
              Choose how you want to close your {selectedPosition?.market} position
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <RadioGroup value={closeOrderType} onValueChange={(value) => setCloseOrderType(value as 'MARKET' | 'LIMIT')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="MARKET" id="market" />
                <Label htmlFor="market" className="flex-1 cursor-pointer">
                  <div className="font-medium">Market Order</div>
                  <div className="text-xs text-muted-foreground">Close immediately at current market price</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="LIMIT" id="limit" />
                <Label htmlFor="limit" className="flex-1 cursor-pointer">
                  <div className="font-medium">Limit Order</div>
                  <div className="text-xs text-muted-foreground">Close at a specific price or better</div>
                </Label>
              </div>
            </RadioGroup>

            {closeOrderType === 'LIMIT' && (
              <div className="space-y-2">
                <Label htmlFor="limitPrice">Limit Price</Label>
                <Input
                  id="limitPrice"
                  type="number"
                  step="0.01"
                  placeholder="Enter price"
                  value={closeLimitPrice}
                  onChange={(e) => setCloseLimitPrice(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleClosePosition}>
              Close Position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
