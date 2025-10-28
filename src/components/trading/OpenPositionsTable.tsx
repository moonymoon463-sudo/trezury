import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSnxPositions } from '@/hooks/useSnxPositions';
import type { SnxPosition } from '@/types/snx';
import { snxTradingService } from '@/services/snxTradingService';
import { TrendingUp, TrendingDown, AlertCircle, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTradingPasswordContext } from '@/contexts/TradingPasswordContext';

interface OpenPositionsTableProps {
  accountId?: bigint;
  chainId: number;
  currentPrices: Record<string, number>;
}

export const OpenPositionsTable = ({ accountId, chainId, currentPrices }: OpenPositionsTableProps) => {
  const { positions, loading, error } = useSnxPositions(accountId, chainId);
  const { toast } = useToast();
  const { getPassword } = useTradingPasswordContext();
  const [closingPosition, setClosingPosition] = useState<string | null>(null);

  const handleClosePosition = async (marketKey: string) => {
    if (!accountId) return;

    const password = getPassword();
    if (!password) {
      toast({
        variant: 'destructive',
        title: 'Session Locked',
        description: 'Please unlock your trading session first',
      });
      return;
    }

    setClosingPosition(marketKey);
    
    try {
      const response = await snxTradingService.closePosition(accountId, marketKey, 'internal', password, chainId);
      
      if (response.success) {
        toast({
          title: 'Position Closed',
          description: `Successfully closed ${marketKey} position`,
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

  if (positions.length === 0) {
    return (
      <Card className="bg-card/30 border-border/30">
        <div className="p-6 text-center">
          <p className="text-muted-foreground text-sm">No open positions</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card/30 border-border/30">
      <div className="p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Current</TableHead>
              <TableHead>P&L</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => {
              const currentPrice = currentPrices[position.marketKey] || position.entryPrice;
              const pnl = position.unrealizedPnl;
              const isProfit = pnl > 0;

              return (
                <TableRow key={position.marketKey}>
                  <TableCell className="font-medium">{position.marketKey}</TableCell>
                  <TableCell>
                    <Badge variant={position.side === 'LONG' ? 'default' : 'destructive'}>
                      {position.side}
                    </Badge>
                  </TableCell>
                  <TableCell>{position.size.toFixed(4)}</TableCell>
                  <TableCell>${position.entryPrice.toFixed(2)}</TableCell>
                  <TableCell>${currentPrice.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className={`flex items-center gap-1 ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                      {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {isProfit ? '+' : ''}${pnl.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleClosePosition(position.marketKey)}
                      disabled={closingPosition === position.marketKey}
                    >
                      {closingPosition === position.marketKey ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
