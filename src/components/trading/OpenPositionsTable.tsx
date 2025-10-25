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
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  const handleClosePosition = async (market: string) => {
    const password = getPassword();
    if (!password) {
      toast({
        variant: 'destructive',
        title: 'Session Locked',
        description: 'Please unlock your trading session first',
      });
      return;
    }

    setClosingPosition(market);
    try {
      const response = await dydxTradingService.closePosition(market, password);
      if (response.success) {
        toast({
          title: 'Position Closed',
          description: `Successfully closed ${market} position`,
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

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="text-[#c6b795] cursor-pointer hover:text-white transition-colors" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <Card className="bg-[#2a251a] border-[#463c25]">
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#e6b951]" />
          <span className="ml-2 text-[#c6b795]">Loading positions...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-[#2a251a] border-[#463c25]">
        <div className="p-6 flex items-center justify-center text-red-400">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      </Card>
    );
  }

  if (sortedPositions.length === 0) {
    return (
      <Card className="bg-[#2a251a] border-[#463c25]">
        <div className="p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-[#463c25] flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-[#c6b795]" />
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">No Open Positions</h3>
              <p className="text-[#c6b795] text-sm">No open positions at this time.</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-[#2a251a] border-[#463c25]">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Open Positions</h3>
          <Badge variant="outline" className="text-[#e6b951] border-[#e6b951]/30">
            {sortedPositions.length} Position{sortedPositions.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        <TooltipProvider>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#463c25] hover:bg-transparent">
                  <SortableHeader field="market">
                    <TooltipTrigger asChild>
                      <span>Asset Pair</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The trading pair for this position</p>
                    </TooltipContent>
                  </SortableHeader>

                  <TableHead className="text-[#c6b795]">
                    <TooltipTrigger asChild>
                      <span>Entry Price</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The price at which the position was opened</p>
                    </TooltipContent>
                  </TableHead>

                  <TableHead className="text-[#c6b795]">
                    <TooltipTrigger asChild>
                      <span>Current Price</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The current market price of the asset</p>
                    </TooltipContent>
                  </TableHead>

                  <SortableHeader field="size">
                    <TooltipTrigger asChild>
                      <span>Position Size</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Amount of the asset held in this position</p>
                    </TooltipContent>
                  </SortableHeader>

                  <SortableHeader field="leverage">
                    <TooltipTrigger asChild>
                      <span>Leverage</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The leverage multiplier used for this position</p>
                    </TooltipContent>
                  </SortableHeader>

                  <SortableHeader field="pnl">
                    <TooltipTrigger asChild>
                      <span>Unrealized P&L</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Profit and Loss that would be realized if closed now</p>
                    </TooltipContent>
                  </SortableHeader>

                  <TableHead className="text-[#c6b795]">
                    <TooltipTrigger asChild>
                      <span>Margin Required</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>The amount of collateral required to maintain this position</p>
                    </TooltipContent>
                  </TableHead>

                  <SortableHeader field="liquidation">
                    <TooltipTrigger asChild>
                      <span>Liquidation Price</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Price at which the position will be automatically liquidated</p>
                    </TooltipContent>
                  </SortableHeader>

                  <TableHead className="text-[#c6b795]">Action</TableHead>
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
                  
                  // Determine risk level based on distance to liquidation
                  const riskLevel = 
                    distanceToLiquidation < 5 ? 'critical' :
                    distanceToLiquidation < 15 ? 'high' :
                    distanceToLiquidation < 30 ? 'medium' : 'low';

                  return (
                    <TableRow key={`${position.market}-${index}`} className="border-[#463c25] hover:bg-[#463c25]/20">
                      <TableCell className="font-medium text-white">
                        <div className="flex items-center gap-2">
                          {position.market}
                          <Badge
                            variant={position.side === 'LONG' ? 'default' : 'destructive'}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {position.side}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell className="text-white">
                        ${position.entryPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>

                      <TableCell className="text-white">
                        ${currentPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>

                      <TableCell className="text-white">
                        {position.size.toLocaleString(undefined, {
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4,
                        })}
                      </TableCell>

                      <TableCell className="text-white">
                        <Badge variant="outline" className="text-[#e6b951] border-[#e6b951]/30">
                          {leverage}x
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <div className={`flex items-center gap-1 font-semibold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                            {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {isProfit ? '+' : ''}${pnl.toFixed(2)}
                          </div>
                          <span className={`text-xs ${isProfit ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-white">
                        ${marginRequired.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-white">
                            ${liquidationPrice.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div
                              className={`h-1.5 w-1.5 rounded-full ${
                                riskLevel === 'critical'
                                  ? 'bg-red-500'
                                  : riskLevel === 'high'
                                  ? 'bg-orange-500'
                                  : riskLevel === 'medium'
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                            />
                            <span className="text-[10px] text-[#c6b795]">
                              {distanceToLiquidation.toFixed(1)}% away
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleClosePosition(position.market)}
                          disabled={closingPosition === position.market}
                          className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-950/20"
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
    </Card>
  );
};
