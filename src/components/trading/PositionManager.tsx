import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { snxTradingService } from '@/services/snxTradingService';
import type { SnxPosition } from '@/types/snx';
import { TrendingUp, TrendingDown, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTradingPasswordContext } from '@/contexts/TradingPasswordContext';

interface PositionManagerProps {
  accountId?: bigint;
  chainId: number;
  currentPrices: Record<string, number>;
}

export const PositionManager: React.FC<PositionManagerProps> = ({ accountId, chainId, currentPrices }) => {
  const [positions, setPositions] = useState<SnxPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const { toast } = useToast();
  const { getPassword } = useTradingPasswordContext();

  useEffect(() => {
    if (!accountId) return;

    const loadPositions = async () => {
      setLoading(true);
      try {
        const data = await snxTradingService.getOpenPositions(accountId, chainId);
        setPositions(data);
      } catch (error) {
        console.error('[PositionManager] Failed to load:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPositions();
    const interval = setInterval(loadPositions, 15000);
    return () => clearInterval(interval);
  }, [accountId, chainId]);

  const handleClosePosition = async (marketKey: string) => {
    if (!accountId) return;

    const password = getPassword();
    if (!password) {
      toast({
        variant: 'destructive',
        title: 'Session Locked',
        description: 'Please unlock your trading session first'
      });
      return;
    }

    setClosingPosition(marketKey);
    try {
      const response = await snxTradingService.closePosition(accountId, marketKey, 'internal', password, chainId);
      if (response.success) {
        toast({
          title: 'Position Closed',
          description: `Successfully closed ${marketKey} position`
        });
        const data = await snxTradingService.getOpenPositions(accountId, chainId);
        setPositions(data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Close',
          description: response.error
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setClosingPosition(null);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-foreground">
          <span>Open Positions</span>
          <Badge variant="outline">{positions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No open positions</p>
        ) : (
          <div className="space-y-2">
            {positions.map(position => {
              const currentPrice = currentPrices[position.marketKey] || position.entryPrice;
              const pnl = position.unrealizedPnl;
              const pnlPercent = (pnl / (position.size * position.entryPrice)) * 100;
              const isProfit = pnl > 0;

              return (
                <div key={position.marketKey} className="border border-border rounded-lg p-4 mb-3 bg-card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-lg text-foreground">{position.marketKey}</span>
                        <Badge variant={position.side === 'LONG' ? 'default' : 'destructive'}>
                          {position.side} {position.leverage}×
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Size: {position.size} @ ${position.entryPrice.toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <div className={`flex items-center gap-1 text-lg font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                        {isProfit ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                        {isProfit ? '+' : ''}${pnl.toFixed(2)}
                      </div>
                      <p className={`text-sm ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                        {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current Price:</span>
                      <span className="font-medium text-foreground">${currentPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Liquidation Price:</span>
                      <span className="font-medium text-foreground">${position.liquidationPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleClosePosition(position.marketKey)}
                    disabled={closingPosition === position.marketKey}
                    className="w-full"
                  >
                    {closingPosition === position.marketKey ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Closing...
                      </>
                    ) : (
                      'Close Position'
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
