import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useDydxPositions } from '@/hooks/useDydxPositions';
import type { DydxPosition } from '@/types/dydx';
import { dydxTradingService } from '@/services/dydxTradingService';
import { TrendingUp, TrendingDown, AlertCircle, ArrowUpDown, X, Loader2 } from 'lucide-react';
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
  const [sortField, setSortField] = useState<SortField>('market');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<DydxPosition | null>(null);
  const [closeOrderType, setCloseOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [closeLimitPrice, setCloseLimitPrice] = useState('');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedPositions = useMemo(() => {
    if (!positions.length) return [];

    return [...positions].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'market':
          comparison = a.market.localeCompare(b.market);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'pnl': {
          const priceA = currentPrices[a.market] || a.entryPrice;
          const priceB = currentPrices[b.market] || b.entryPrice;
          const pnlA = a.side === 'LONG'
            ? (priceA - a.entryPrice) * a.size
            : (a.entryPrice - priceA) * a.size;
          const pnlB = b.side === 'LONG'
            ? (priceB - b.entryPrice) * b.size
            : (b.entryPrice - priceB) * b.size;
          comparison = pnlA - pnlB;
          break;
        }
        case 'leverage':
          // DydxPosition doesn't have leverage, so we'll skip sorting by it
          comparison = 0;
          break;
        case 'liquidation':
          // DydxPosition doesn't have liquidation_price in the type, so we'll calculate it
          comparison = 0;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [positions, sortField, sortDirection, currentPrices]);

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

  const SortableHeader = ({ field, label, tooltip }: { field: SortField; label: string; tooltip: string }) => (
    <TableHead className="h-8 text-muted-foreground/70 cursor-pointer hover:text-foreground transition-colors text-[11px] font-medium" onClick={() => handleSort(field)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <span>{label}</span>
            <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TableHead>
  );

  if (loading) {
    return (
      <Card className="bg-card/30 border-border/30">
        <div className="p-4 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground text-xs">Loading...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card/30 border-border/30">
        <div className="p-4 flex items-center justify-center text-destructive text-xs">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      </Card>
    );
  }

  if (sortedPositions.length === 0) {
    return (
      <Card className="bg-card/30 border-border/30">
        <div className="p-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div>
              <h3 className="text-foreground font-medium text-sm">No Open Positions</h3>
              <p className="text-muted-foreground text-xs mt-0.5">No open positions at this time.</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card/30 border-border/30">
      <div className="p-2">
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-foreground font-medium text-sm">Open Positions</h3>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-primary/80 border-primary/20 bg-primary/5">
            {sortedPositions.length}
          </Badge>
        </div>

        <TooltipProvider>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <SortableHeader 
                    field="market" 
                    label="Asset Pair" 
                    tooltip="The trading pair for this position"
                  />

                  <TableHead className="h-8 text-muted-foreground/70 text-[11px] font-medium">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Entry</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p>The price at which the position was opened</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>

                  <TableHead className="h-8 text-muted-foreground/70 text-[11px] font-medium">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Current</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p>The current market price of the asset</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>

                  <SortableHeader 
                    field="size" 
                    label="Size" 
                    tooltip="Amount of the asset held in this position"
                  />

                  <SortableHeader 
                    field="leverage" 
                    label="Leverage" 
                    tooltip="The leverage multiplier used for this position"
                  />

                  <SortableHeader 
                    field="pnl" 
                    label="P&L" 
                    tooltip="Profit and Loss that would be realized if closed now"
                  />

                  <TableHead className="h-8 text-muted-foreground/70 text-[11px] font-medium">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Margin</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p>The amount of collateral required to maintain this position</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>

                  <SortableHeader 
                    field="liquidation" 
                    label="Liq. Price" 
                    tooltip="Price at which the position will be automatically liquidated"
                  />

                  <TableHead className="h-8 text-muted-foreground/70 text-[11px] font-medium w-12">Close</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                 {sortedPositions.map((position, index) => {
                  const currentPrice = currentPrices[position.market] || position.entryPrice;
                  const pnl = position.side === 'LONG'
                    ? (currentPrice - position.entryPrice) * position.size
                    : (position.entryPrice - currentPrice) * position.size;
                  const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100 * (position.side === 'LONG' ? 1 : -1);
                  const isProfit = pnl > 0;
                  
                  // Assume 10x leverage if not available in the position data
                  const leverage = 10;
                  const marginRequired = (currentPrice * position.size) / leverage;
                  
                  // Calculate liquidation price
                  const maintenanceMargin = 0.03; // 3% maintenance margin
                  const liquidationPrice = position.side === 'LONG'
                    ? position.entryPrice * (1 - (1 / leverage) + maintenanceMargin)
                    : position.entryPrice * (1 + (1 / leverage) - maintenanceMargin);
                  
                  // Calculate distance to liquidation
                  const distanceToLiquidation = Math.abs(((currentPrice - liquidationPrice) / currentPrice) * 100);
                  
                  // Calculate breakeven price (entry + estimated fees)
                  const estimatedFees = position.entryPrice * 0.001; // 0.1% total fees estimate
                  const breakevenPrice = position.side === 'LONG' 
                    ? position.entryPrice + estimatedFees
                    : position.entryPrice - estimatedFees;
                  
                  // Determine risk level based on distance to liquidation
                  const riskLevel = 
                    distanceToLiquidation < 5 ? 'critical' :
                    distanceToLiquidation < 15 ? 'high' :
                    distanceToLiquidation < 30 ? 'medium' : 'low';

                  return (
                    <TableRow key={`${position.market}-${index}`} className="border-border/20 hover:bg-accent/5">
                      <TableCell className="font-medium text-foreground py-1.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{position.market}</span>
                          <Badge
                            variant={position.side === 'LONG' ? 'default' : 'destructive'}
                            className="text-[9px] h-4 px-1 py-0"
                          >
                            {position.side}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground text-xs py-1.5">
                        ${position.entryPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>

                      <TableCell className="text-foreground text-xs font-medium py-1.5">
                        ${currentPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>

                      <TableCell className="text-muted-foreground text-xs py-1.5">
                        {position.size.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </TableCell>

                      <TableCell className="py-1.5">
                        <Badge variant="outline" className="text-[9px] h-4 px-1 text-primary/80 border-primary/20 bg-primary/5">
                          {leverage}x
                        </Badge>
                      </TableCell>

                      <TableCell className="py-1.5">
                        <div className="flex flex-col">
                          <div className={`flex items-center gap-0.5 font-semibold text-xs ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                            {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {isProfit ? '+' : ''}${pnl.toFixed(2)}
                          </div>
                          <span className={`text-[10px] ${isProfit ? 'text-green-500/50' : 'text-red-500/50'}`}>
                            {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground text-xs py-1.5">
                        ${marginRequired.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>

                      <TableCell className="py-1.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-foreground text-xs">
                              ${liquidationPrice.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            <div
                              className={`h-1 w-1 rounded-full ${
                                riskLevel === 'critical'
                                  ? 'bg-red-500'
                                  : riskLevel === 'high'
                                  ? 'bg-orange-500'
                                  : riskLevel === 'medium'
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                            />
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[9px] text-muted-foreground/60 cursor-help">
                                {distanceToLiquidation.toFixed(1)}% away | BE: ${breakevenPrice.toFixed(2)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <p>Distance to Liquidation: {distanceToLiquidation.toFixed(2)}%</p>
                              <p>Breakeven Price: ${breakevenPrice.toFixed(2)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>

                      <TableCell className="py-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openCloseDialog(position)}
                          disabled={closingPosition === position.market}
                          className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        >
                          {closingPosition === position.market ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      </div>

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
    </Card>
  );
};
